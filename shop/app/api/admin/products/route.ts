import { NextRequest, NextResponse } from 'next/server'
import { getKnackRecords, createKnackRecord } from '@/lib/knack-client'
import { KNACK_CONFIG, getFieldValue } from '@/lib/knack-config'

export const dynamic = 'force-dynamic'

const PRODUCTS_OBJECT_KEY = KNACK_CONFIG.objectKeys.products
const VARIANTS_OBJECT_KEY = KNACK_CONFIG.objectKeys.variants
const PRODUCT_FIELDS = KNACK_CONFIG.fields.products
const VARIANT_FIELDS = KNACK_CONFIG.fields.variants

// GET /api/admin/products - List all products with filters
export async function GET(request: NextRequest) {
  try {
    const searchParams = request.nextUrl.searchParams
    const status = searchParams.get('status')
    const category = searchParams.get('category')
    const search = searchParams.get('search')
    const page = parseInt(searchParams.get('page') || '1')
    const limit = parseInt(searchParams.get('limit') || '20')

    // Build filters
    const filters: Record<string, unknown> = {}
    if (status && status !== 'all') {
      filters[PRODUCT_FIELDS.status] = status
    }
    if (category && category !== 'all') {
      filters[PRODUCT_FIELDS.category] = category
    }

    // Fetch products
    const products = await getKnackRecords<Record<string, unknown>>(PRODUCTS_OBJECT_KEY, {
      filters: Object.keys(filters).length > 0 ? filters : undefined,
      sortField: PRODUCT_FIELDS.createdAt,
      sortOrder: 'desc',
    })

    // Fetch all variants to count per product
    const allVariants = await getKnackRecords<Record<string, unknown>>(VARIANTS_OBJECT_KEY)

    // Build map of variant counts by product ID
    const variantCountByProduct = new Map<string, number>()
    for (const variant of allVariants) {
      const productConnection = getFieldValue(variant, VARIANT_FIELDS.product, 'Product')
      const productId = extractProductIdFromConnection(productConnection, PRODUCT_FIELDS.id)
      if (productId) {
        variantCountByProduct.set(productId, (variantCountByProduct.get(productId) || 0) + 1)
      }
    }

    // Map to response format
    let mappedProducts = products.map(p => {
      const id = String(getFieldValue(p, PRODUCT_FIELDS.id, 'ID') || p.id || '')
      return {
        id,
        knackId: String(p.id || ''),
        sku: String(getFieldValue(p, PRODUCT_FIELDS.sku, 'SKU') || ''),
        title: String(getFieldValue(p, PRODUCT_FIELDS.title, 'Title') || ''),
        titleOriginal: String(getFieldValue(p, PRODUCT_FIELDS.titleOriginal, 'Title Original') || ''),
        category: String(getFieldValue(p, PRODUCT_FIELDS.category, 'Category') || ''),
        status: String(getFieldValue(p, PRODUCT_FIELDS.status, 'Status') || 'Draft'),
        variantCount: variantCountByProduct.get(id) || variantCountByProduct.get(String(p.id)) || 0,
        url: String(getFieldValue(p, PRODUCT_FIELDS.url, 'URL') || ''),
      }
    })

    // Apply search filter (client-side for simplicity)
    if (search) {
      const searchLower = search.toLowerCase()
      mappedProducts = mappedProducts.filter(p =>
        p.title.toLowerCase().includes(searchLower) ||
        p.sku.toLowerCase().includes(searchLower) ||
        p.titleOriginal.toLowerCase().includes(searchLower)
      )
    }

    // Get unique categories for filter dropdown
    const categories = [...new Set(products.map(p =>
      String(getFieldValue(p, PRODUCT_FIELDS.category, 'Category') || '')
    ).filter(Boolean))]

    // Paginate
    const total = mappedProducts.length
    const totalPages = Math.ceil(total / limit)
    const startIndex = (page - 1) * limit
    const paginatedProducts = mappedProducts.slice(startIndex, startIndex + limit)

    return NextResponse.json({
      products: paginatedProducts,
      pagination: {
        page,
        limit,
        total,
        totalPages,
      },
      filters: {
        categories,
        statuses: ['Active', 'Draft', 'Archived'],
      },
    })
  } catch (error) {
    console.error('[Admin API] Products list error:', error)
    return NextResponse.json(
      { error: 'Failed to fetch products' },
      { status: 500 }
    )
  }
}

// POST /api/admin/products - Create a new product
export async function POST(request: NextRequest) {
  try {
    const body = await request.json()

    // Validate required fields
    if (!body.title) {
      return NextResponse.json(
        { error: 'Title is required' },
        { status: 400 }
      )
    }

    // Generate SKU if not provided
    const sku = body.sku || `PROD-${Date.now()}`
    const productId = body.id || sku

    // Build product data
    const productData: Record<string, unknown> = {}
    productData[PRODUCT_FIELDS.id] = productId
    productData[PRODUCT_FIELDS.sku] = sku
    productData[PRODUCT_FIELDS.title] = body.title
    productData[PRODUCT_FIELDS.titleOriginal] = body.titleOriginal || null
    productData[PRODUCT_FIELDS.description] = body.description || null
    productData[PRODUCT_FIELDS.category] = body.category || null
    productData[PRODUCT_FIELDS.status] = body.status || 'Draft'
    productData[PRODUCT_FIELDS.url] = body.url || null

    const knackRecordId = await createKnackRecord(PRODUCTS_OBJECT_KEY, productData)

    return NextResponse.json({
      id: productId,
      knackId: knackRecordId,
      message: 'Product created successfully',
    }, { status: 201 })
  } catch (error) {
    console.error('[Admin API] Product create error:', error)
    return NextResponse.json(
      { error: 'Failed to create product' },
      { status: 500 }
    )
  }
}

// Helper to extract product ID from Knack connection field
function extractProductIdFromConnection(connection: unknown, idField: string): string | null {
  if (typeof connection === 'string') {
    // Check if it's HTML
    if (connection.includes('<') && connection.includes('>')) {
      // Extract from class attribute (Knack record ID)
      const classMatch = connection.match(/class="([a-f0-9]{24})"/)
      if (classMatch && classMatch[1]) {
        return classMatch[1]
      }
      // Extract text content
      const match = connection.match(/data-kn="connection-value">([^<]+)</) ||
                   connection.match(/>([^<]+)</)
      if (match && match[1]) return match[1].trim()
      // Strip HTML
      return connection.replace(/<[^>]*>/g, '').trim() || null
    }
    return connection.trim() || null
  }

  if (Array.isArray(connection) && connection.length > 0) {
    return extractProductIdFromConnection(connection[0], idField)
  }

  if (typeof connection === 'object' && connection !== null) {
    const obj = connection as Record<string, unknown>
    if (obj.id) return String(obj.id)
    if (obj.identifier) return String(obj.identifier)
    if (obj[idField]) return String(obj[idField])
  }

  return null
}
