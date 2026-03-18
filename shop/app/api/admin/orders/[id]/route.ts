import { NextRequest, NextResponse } from 'next/server'
import { requireAdmin } from '@/lib/require-admin'
import { getKnackRecord, getKnackRecords, updateKnackRecord } from '@/lib/knack-client'
import { KNACK_CONFIG, getFieldValue } from '@/lib/knack-config'

export const dynamic = 'force-dynamic'

const ORDERS_OBJECT_KEY = KNACK_CONFIG.objectKeys.orders
const ORDER_FIELDS = KNACK_CONFIG.fields.orders
const VARIANT_FIELDS = KNACK_CONFIG.fields.variants
const PRODUCT_FIELDS = KNACK_CONFIG.fields.products

type OrderItem = {
  variantId: string
  productId: string
  productTitle: string
  variantTitle: string
  sku: string
  quantity: number
  unitPriceCad: number
  selectedSize?: string | null
  isAddon?: boolean
  regularPrice?: number
  addonPrice?: number
}

function parseJson<T>(raw: unknown): T | null {
  if (!raw) return null
  try {
    const str = typeof raw === 'string' ? raw : String(raw)
    return JSON.parse(str) as T
  } catch {
    return null
  }
}

/**
 * PATCH /api/admin/orders/[id] — Update order payment status or order status
 */
export async function PATCH(
  request: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  const adminCheck = await requireAdmin(request)
  if (adminCheck instanceof NextResponse) return adminCheck

  const { id } = await params

  try {
    const body = await request.json()
    const updates: Record<string, unknown> = {
      [ORDER_FIELDS.updatedAt]: new Date().toISOString(),
    }

    // Update payment status
    if (body.paymentStatus) {
      const validPaymentStatuses = ['Pending', 'Received', 'Refunded', 'Cancelled']
      if (!validPaymentStatuses.includes(body.paymentStatus)) {
        return NextResponse.json({ error: 'Invalid payment status' }, { status: 400 })
      }
      updates[ORDER_FIELDS.paymentStatus] = body.paymentStatus

      // If marking as received, record the timestamp
      if (body.paymentStatus === 'Received') {
        updates[ORDER_FIELDS.paymentReceivedAt] = new Date().toISOString()
      }
    }

    // Update order status
    if (body.status) {
      const validStatuses = ['Placed', 'Confirmed', 'Processing', 'Shipped', 'Delivered', 'Cancelled']
      if (!validStatuses.includes(body.status)) {
        return NextResponse.json({ error: 'Invalid order status' }, { status: 400 })
      }
      updates[ORDER_FIELDS.status] = body.status

      // Append to status history
      const existing = await getKnackRecord<Record<string, unknown>>(ORDERS_OBJECT_KEY, id)
      if (existing) {
        const history = parseJson<{ status: string; at: string }[]>(
          getFieldValue(existing, ORDER_FIELDS.statusHistory, 'statusHistory')
        ) || []
        history.push({ status: body.status, at: new Date().toISOString() })
        updates[ORDER_FIELDS.statusHistory] = JSON.stringify(history)
      }
    }

    // Update e-transfer reference
    if (body.etransferRef !== undefined) {
      updates[ORDER_FIELDS.etransferRef] = body.etransferRef
    }

    await updateKnackRecord(ORDERS_OBJECT_KEY, id, updates)

    return NextResponse.json({ ok: true })
  } catch (error) {
    console.error('[Admin Orders API] Update error:', error)
    return NextResponse.json({ error: 'Failed to update order' }, { status: 500 })
  }
}

/**
 * GET /api/admin/orders/[id] — Get single order with enriched variant data (Taobao links)
 */
export async function GET(
  request: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  const adminCheck = await requireAdmin(request)
  if (adminCheck instanceof NextResponse) return adminCheck

  const { id } = await params

  try {
    const record = await getKnackRecord<Record<string, unknown>>(ORDERS_OBJECT_KEY, id)
    if (!record) {
      return NextResponse.json({ error: 'Order not found' }, { status: 404 })
    }

    const items = parseJson<OrderItem[]>(
      getFieldValue(record, ORDER_FIELDS.itemsJson, 'itemsJson')
    ) || []

    // Fetch variant records for cost and Chinese names
    const variantIds = items.map(i => i.variantId).filter(Boolean)
    const variantMap = new Map<string, { chineseName: string; costCad: number }>()

    if (variantIds.length > 0) {
      try {
        const allVariants = await getKnackRecords<Record<string, unknown>>(
          KNACK_CONFIG.objectKeys.variants,
          { perPage: 1000 }
        )
        for (const v of allVariants) {
          const vid = String(v.id)
          if (variantIds.includes(vid)) {
            variantMap.set(vid, {
              chineseName: String(getFieldValue(v, VARIANT_FIELDS.chineseName, 'chineseName') || ''),
              costCad: Number(getFieldValue(v, VARIANT_FIELDS.totalCostCad, 'totalCostCad') || 0),
            })
          }
        }
      } catch {
        // Continue without variant enrichment
      }
    }

    // Fetch products to get Taobao URL (field_55 on Object 6)
    const productIds = [...new Set(items.map(i => i.productId).filter(Boolean))]
    const productUrlMap = new Map<string, string>()
    if (productIds.length > 0) {
      try {
        const allProducts = await getKnackRecords<Record<string, unknown>>(
          KNACK_CONFIG.objectKeys.products,
          { perPage: 1000 }
        )
        for (const p of allProducts) {
          // Match by field_45 (ID field) which is what itemsJson stores as productId
          const idField = String(getFieldValue(p, PRODUCT_FIELDS.id, 'ID') || '')
          const url = String(getFieldValue(p, PRODUCT_FIELDS.url, 'URL') || '')
          if (idField && url) productUrlMap.set(idField, url)
          // Also map by Knack record ID
          if (url) productUrlMap.set(String(p.id), url)
        }
      } catch {
        // Continue without product URLs
      }
    }

    // Enrich items with Taobao URL (from product), cost, and Chinese name (from variant)
    let orderCost = 0
    const enrichedItems = items.map(item => {
      const variantData = variantMap.get(item.variantId)
      const costPerUnit = variantData?.costCad || 0
      orderCost += costPerUnit * item.quantity
      // Taobao link from product URL (field_55)
      const taobaoLink = productUrlMap.get(item.productId) || null
      return {
        ...item,
        taobaoLink,
        chineseName: variantData?.chineseName || null,
        costCad: costPerUnit,
      }
    })

    // Resolve customer info
    const userRaw = getFieldValue(record, ORDER_FIELDS.userId, 'User')
    let connectedUserId: string | null = null
    if (Array.isArray(userRaw) && userRaw.length > 0) {
      const first = userRaw[0]
      connectedUserId = typeof first === 'object' && first !== null
        ? String((first as Record<string, unknown>).id || '')
        : String(first)
    } else if (typeof userRaw === 'string' && userRaw) {
      connectedUserId = userRaw
    }

    let customerName = ''
    let customerEmail = ''
    let customerPhone = ''

    if (connectedUserId) {
      try {
        const { getUserById } = await import('@/lib/knack-users')
        const user = await getUserById(connectedUserId)
        if (user) {
          customerName = user.displayName || user.name
          customerEmail = user.email
          customerPhone = user.phone || ''
        }
      } catch {
        // Continue without customer info
      }
    }

    const statusHistory = parseJson<{ status: string; at: string }[]>(
      getFieldValue(record, ORDER_FIELDS.statusHistory, 'statusHistory')
    ) || []

    const totalCad = Number(getFieldValue(record, ORDER_FIELDS.totalCad, 'totalCad') || 0)

    return NextResponse.json({
      id: String(record.id),
      orderNumber: String(getFieldValue(record, ORDER_FIELDS.orderNumber, 'orderNumber') || ''),
      customerName,
      customerEmail,
      customerPhone,
      items: enrichedItems,
      subtotalCad: Number(getFieldValue(record, ORDER_FIELDS.subtotalCad, 'subtotalCad') || 0),
      shippingCad: Number(getFieldValue(record, ORDER_FIELDS.shippingCad, 'shippingCad') || 0),
      promoCode: String(getFieldValue(record, ORDER_FIELDS.promoCode, 'promoCode') || '') || null,
      promoDiscountCad: Number(getFieldValue(record, ORDER_FIELDS.promoDiscountCad, 'promoDiscountCad') || 0),
      totalCad,
      costCad: orderCost,
      profitCad: totalCad - orderCost,
      paymentMethod: String(getFieldValue(record, ORDER_FIELDS.paymentMethod, 'paymentMethod') || ''),
      paymentStatus: String(getFieldValue(record, ORDER_FIELDS.paymentStatus, 'paymentStatus') || ''),
      etransferRef: String(getFieldValue(record, ORDER_FIELDS.etransferRef, 'etransferRef') || '') || null,
      paymentReceivedAt: getFieldValue(record, ORDER_FIELDS.paymentReceivedAt, 'paymentReceivedAt') || null,
      status: String(getFieldValue(record, ORDER_FIELDS.status, 'status') || ''),
      statusHistory,
      createdAt: getFieldValue(record, ORDER_FIELDS.createdAt, 'createdAt') || null,
      updatedAt: getFieldValue(record, ORDER_FIELDS.updatedAt, 'updatedAt') || null,
    })
  } catch (error) {
    console.error('[Admin Orders API] Detail error:', error)
    return NextResponse.json({ error: 'Failed to load order' }, { status: 500 })
  }
}
