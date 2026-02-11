import { NextResponse } from 'next/server'
import { getKnackRecords } from '@/lib/knack-client'
import { KNACK_CONFIG, getFieldValue } from '@/lib/knack-config'

export const dynamic = 'force-dynamic'

const PRODUCTS_OBJECT_KEY = KNACK_CONFIG.objectKeys.products
const VARIANTS_OBJECT_KEY = KNACK_CONFIG.objectKeys.variants
const ORDERS_OBJECT_KEY = KNACK_CONFIG.objectKeys.orders
const PRODUCT_FIELDS = KNACK_CONFIG.fields.products
const ORDER_FIELDS = KNACK_CONFIG.fields.orders

export async function GET() {
  try {
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

    // Fetch orders to count pending
    let pendingOrdersCount = 0
    try {
      const orders = await getKnackRecords<Record<string, unknown>>(ORDERS_OBJECT_KEY, {
        filters: { [ORDER_FIELDS.status]: 'Pending' }
      })
      pendingOrdersCount = orders.length
    } catch {
      // Orders might not be set up yet
    }

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
      pendingOrders: pendingOrdersCount,
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
