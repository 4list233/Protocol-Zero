import { NextRequest, NextResponse } from 'next/server'
import { getKnackRecords } from '@/lib/knack-client'
import { KNACK_CONFIG, getFieldValue } from '@/lib/knack-config'
import { requireAdmin } from '@/lib/require-admin'

export const dynamic = 'force-dynamic'

const PRODUCTS_OBJECT_KEY = KNACK_CONFIG.objectKeys.products
const VARIANTS_OBJECT_KEY = KNACK_CONFIG.objectKeys.variants
const ORDERS_OBJECT_KEY = KNACK_CONFIG.objectKeys.orders
const PRODUCT_FIELDS = KNACK_CONFIG.fields.products
const ORDER_FIELDS = KNACK_CONFIG.fields.orders
const VARIANT_FIELDS = KNACK_CONFIG.fields.variants

export async function GET(request: NextRequest) {
  try {
    const authCheck = await requireAdmin(request)
    if (authCheck instanceof NextResponse) return authCheck

    // Fetch all products to count by status
    const products = await getKnackRecords<Record<string, unknown>>(PRODUCTS_OBJECT_KEY)

    // Count products by status
    let activeCount = 0
    let draftCount = 0
    let archivedCount = 0

    for (const product of products) {
      const status = getFieldValue(product, PRODUCT_FIELDS.status, 'Status')
      if (status === 'Active') activeCount++
      else if (status === 'Draft') draftCount++
      else if (status === 'Archived') archivedCount++
    }

    // Fetch orders to count by payment status and calculate profit
    let totalOrdersCount = 0
    let pendingOrdersCount = 0
    let totalRevenue = 0
    let totalCost = 0
    let totalPromoDiscount = 0
    try {
      const orders = await getKnackRecords<Record<string, unknown>>(ORDERS_OBJECT_KEY)
      totalOrdersCount = orders.length

      // Build variant cost map for profit calculation
      const variantCostMap = new Map<string, number>()
      try {
        const variants = await getKnackRecords<Record<string, unknown>>(VARIANTS_OBJECT_KEY, { perPage: 1000 })
        for (const v of variants) {
          variantCostMap.set(String(v.id), Number(getFieldValue(v, VARIANT_FIELDS.costCad, 'costCad') || 0))
        }
      } catch {
        // Continue without cost data
      }

      for (const o of orders) {
        const paymentStatus = getFieldValue(o, ORDER_FIELDS.paymentStatus, 'paymentStatus')
        if (paymentStatus === 'Pending') pendingOrdersCount++

        // Calculate revenue & cost for paid orders
        if (paymentStatus === 'Received') {
          const orderTotal = Number(getFieldValue(o, ORDER_FIELDS.totalCad, 'totalCad') || 0)
          const promoDiscount = Number(getFieldValue(o, ORDER_FIELDS.promoDiscountCad, 'promoDiscountCad') || 0)
          totalRevenue += orderTotal
          totalPromoDiscount += promoDiscount

          // Parse items to calculate cost of goods
          try {
            const itemsRaw = getFieldValue(o, ORDER_FIELDS.itemsJson, 'itemsJson')
            if (itemsRaw) {
              const items = JSON.parse(String(itemsRaw)) as { variantId: string; quantity: number }[]
              for (const item of items) {
                const costPerUnit = variantCostMap.get(item.variantId) || 0
                totalCost += costPerUnit * item.quantity
              }
            }
          } catch {
            // Skip cost calculation for this order
          }
        }
      }
    } catch {
      // Orders might not be set up yet
    }

    const totalProfit = totalRevenue - totalCost

    // Get recent products (last 10)
    const sortedProducts = [...products].sort((a, b) => {
      const aDate = getFieldValue(a, PRODUCT_FIELDS.createdAt, 'Created At')
      const bDate = getFieldValue(b, PRODUCT_FIELDS.createdAt, 'Created At')
      if (!aDate || !bDate) return 0
      return new Date(String(bDate)).getTime() - new Date(String(aDate)).getTime()
    }).slice(0, 10)

    const recentProducts = sortedProducts.map(p => ({
      id: getFieldValue(p, PRODUCT_FIELDS.id, 'ID') || p.id,
      title: getFieldValue(p, PRODUCT_FIELDS.title, 'Title') || 'Untitled',
      status: getFieldValue(p, PRODUCT_FIELDS.status, 'Status') || 'Draft',
      sku: getFieldValue(p, PRODUCT_FIELDS.sku, 'SKU') || '',
      priceCadBase: Number(getFieldValue(p, PRODUCT_FIELDS.priceCadBase, 'Price CAD Base') || 0),
    }))

    return NextResponse.json({
      totalProducts: products.length,
      activeProducts: activeCount,
      draftProducts: draftCount,
      archivedProducts: archivedCount,
      totalOrders: totalOrdersCount,
      pendingOrders: pendingOrdersCount,
      totalRevenue,
      totalCost,
      totalProfit,
      totalPromoDiscount,
      recentProducts,
    })
  } catch (error) {
    console.error('[Admin API] Stats fetch error:', error)
    return NextResponse.json(
      { error: 'Failed to fetch stats' },
      { status: 500 }
    )
  }
}
