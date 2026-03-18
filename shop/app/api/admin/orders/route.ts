import { NextRequest, NextResponse } from 'next/server'
import { requireAdmin } from '@/lib/require-admin'
import { getKnackRecords } from '@/lib/knack-client'
import { KNACK_CONFIG, getFieldValue } from '@/lib/knack-config'

export const dynamic = 'force-dynamic'

const ORDERS_OBJECT_KEY = KNACK_CONFIG.objectKeys.orders
const ORDER_FIELDS = KNACK_CONFIG.fields.orders
const USER_FIELDS = KNACK_CONFIG.fields.users
const VARIANT_FIELDS = KNACK_CONFIG.fields.variants

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

function parseDate(raw: unknown): string | null {
  if (!raw) return null
  const d = new Date(String(raw))
  return isNaN(d.getTime()) ? null : d.toISOString()
}

/**
 * Resolve the connected user record ID from a Knack connection field.
 * Connection fields can be returned as:
 *   - An array of objects: [{ id: "abc123", identifier: "..." }]
 *   - An array of strings: ["abc123"]
 *   - A plain string: "abc123"
 */
function resolveConnectionId(raw: unknown): string | null {
  if (Array.isArray(raw) && raw.length > 0) {
    const first = raw[0]
    if (typeof first === 'object' && first !== null && 'id' in first) {
      return String((first as Record<string, unknown>).id)
    }
    return String(first)
  }
  if (typeof raw === 'string' && raw) return raw
  return null
}

export async function GET(request: NextRequest) {
  const adminCheck = await requireAdmin(request)
  if (adminCheck instanceof NextResponse) return adminCheck

  try {
    const { searchParams } = new URL(request.url)
    const statusFilter = searchParams.get('status')
    const paymentFilter = searchParams.get('payment')

    const filterOptions: Record<string, unknown> = {}
    if (statusFilter) filterOptions[ORDER_FIELDS.status] = statusFilter
    if (paymentFilter) filterOptions[ORDER_FIELDS.paymentStatus] = paymentFilter

    const records = await getKnackRecords<Record<string, unknown>>(ORDERS_OBJECT_KEY, {
      filters: Object.keys(filterOptions).length > 0 ? filterOptions : undefined,
      sortField: ORDER_FIELDS.createdAt,
      sortOrder: 'desc',
    })

    // Batch-fetch all connected users to resolve names/emails/phones
    const userIds = new Set<string>()
    for (const r of records) {
      const uid = resolveConnectionId(getFieldValue(r, ORDER_FIELDS.userId, 'User'))
      if (uid) userIds.add(uid)
    }

    const userMap = new Map<string, Record<string, unknown>>()
    if (userIds.size > 0) {
      try {
        const userRecords = await getKnackRecords<Record<string, unknown>>(
          KNACK_CONFIG.objectKeys.users,
          { perPage: 1000 }
        )
        for (const u of userRecords) {
          userMap.set(String(u.id), u)
        }
      } catch {
        // If user fetch fails, orders still work — just without enriched customer info
      }
    }

    // Build variant cost map for profit calculation
    const variantCostMap = new Map<string, number>()
    try {
      const variants = await getKnackRecords<Record<string, unknown>>(
        KNACK_CONFIG.objectKeys.variants,
        { perPage: 1000 }
      )
      for (const v of variants) {
        variantCostMap.set(String(v.id), Number(getFieldValue(v, VARIANT_FIELDS.totalCostCad, 'totalCostCad') || 0))
      }
    } catch {
      // Continue without cost data
    }

    const orders = records.map(r => {
      const items = parseJson<OrderItem[]>(getFieldValue(r, ORDER_FIELDS.itemsJson, 'itemsJson')) || []
      const statusHistory = parseJson<{ status: string; at: string }[]>(
        getFieldValue(r, ORDER_FIELDS.statusHistory, 'statusHistory')
      ) || []

      // Resolve customer info from user connection
      const connectedUserId = resolveConnectionId(getFieldValue(r, ORDER_FIELDS.userId, 'User'))
      const userRecord = connectedUserId ? userMap.get(connectedUserId) : null

      let customerName = ''
      let customerEmail = ''
      let customerPhone = ''

      if (userRecord) {
        // Name can be a Person field (object with first/last) or a string
        const nameRaw = getFieldValue(userRecord, USER_FIELDS.name, 'Name')
        if (typeof nameRaw === 'object' && nameRaw !== null) {
          const n = nameRaw as Record<string, unknown>
          customerName = [n.first, n.last].filter(Boolean).join(' ')
        } else {
          customerName = String(nameRaw || '')
        }
        // Fallback to displayName
        if (!customerName) {
          customerName = String(getFieldValue(userRecord, USER_FIELDS.displayName, 'Display Name') || '')
        }
        customerEmail = String(getFieldValue(userRecord, USER_FIELDS.email, 'Email') || '')
        customerPhone = String(getFieldValue(userRecord, USER_FIELDS.phone, 'Phone') || '')
      }

      // Calculate cost and profit for this order
      const totalCad = Number(getFieldValue(r, ORDER_FIELDS.totalCad, 'totalCad') || 0)
      let orderCost = 0
      for (const item of items) {
        const costPerUnit = variantCostMap.get(item.variantId) || 0
        orderCost += costPerUnit * item.quantity
      }

      return {
        id: String(r.id),
        orderNumber: String(getFieldValue(r, ORDER_FIELDS.orderNumber, 'orderNumber') || ''),
        customerName,
        customerEmail,
        customerPhone,
        items,
        itemCount: items.reduce((sum, i) => sum + i.quantity, 0),
        subtotalCad: Number(getFieldValue(r, ORDER_FIELDS.subtotalCad, 'subtotalCad') || 0),
        shippingCad: Number(getFieldValue(r, ORDER_FIELDS.shippingCad, 'shippingCad') || 0),
        promoCode: String(getFieldValue(r, ORDER_FIELDS.promoCode, 'promoCode') || '') || null,
        promoDiscountCad: Number(getFieldValue(r, ORDER_FIELDS.promoDiscountCad, 'promoDiscountCad') || 0),
        totalCad,
        costCad: orderCost,
        profitCad: totalCad - orderCost,
        paymentMethod: String(getFieldValue(r, ORDER_FIELDS.paymentMethod, 'paymentMethod') || ''),
        paymentStatus: String(getFieldValue(r, ORDER_FIELDS.paymentStatus, 'paymentStatus') || ''),
        etransferRef: String(getFieldValue(r, ORDER_FIELDS.etransferRef, 'etransferRef') || '') || null,
        paymentReceivedAt: parseDate(getFieldValue(r, ORDER_FIELDS.paymentReceivedAt, 'paymentReceivedAt')),
        status: String(getFieldValue(r, ORDER_FIELDS.status, 'status') || ''),
        statusHistory,
        createdAt: parseDate(getFieldValue(r, ORDER_FIELDS.createdAt, 'createdAt')),
        updatedAt: parseDate(getFieldValue(r, ORDER_FIELDS.updatedAt, 'updatedAt')),
      }
    })

    return NextResponse.json({ orders })
  } catch (error) {
    console.error('[Admin Orders API] Error:', error)
    return NextResponse.json({ error: 'Failed to load orders' }, { status: 500 })
  }
}
