import { NextRequest, NextResponse } from 'next/server'
import {
  getKnackRecords,
  getKnackRecord,
  updateKnackRecord,
  deleteKnackRecord,
} from '@/lib/knack-client'
import { KNACK_CONFIG, getFieldValue, extractCleanUrl } from '@/lib/knack-config'
import { requireAdmin } from '@/lib/require-admin'

export const dynamic = 'force-dynamic'

const PRODUCTS_OBJECT_KEY = KNACK_CONFIG.objectKeys.products
const VARIANTS_OBJECT_KEY = KNACK_CONFIG.objectKeys.variants
const PRODUCT_IMAGES_OBJECT_KEY = KNACK_CONFIG.objectKeys.productImages
const PRODUCT_FIELDS = KNACK_CONFIG.fields.products
const VARIANT_FIELDS = KNACK_CONFIG.fields.variants
const PRODUCT_IMAGE_FIELDS = KNACK_CONFIG.fields.productImages

// GET /api/admin/products/[id] - Get a single product with variants
export async function GET(
  request: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  try {
    const authCheck = await requireAdmin(request)
    if (authCheck instanceof NextResponse) return authCheck

    const { id } = await params
    let product: Record<string, unknown> | null = null
    let knackRecordId = ''

    // Try to find product by ID field (field_45) first
    const byIdField = await getKnackRecords<Record<string, unknown>>(PRODUCTS_OBJECT_KEY, {
      filters: { [PRODUCT_FIELDS.id]: id },
    })

    if (byIdField.length > 0) {
      product = byIdField[0]
      knackRecordId = String(product.id || '')
    }

    // If not found, try by SKU
    if (!product) {
      const bySku = await getKnackRecords<Record<string, unknown>>(PRODUCTS_OBJECT_KEY, {
        filters: { [PRODUCT_FIELDS.sku]: id },
      })
      if (bySku.length > 0) {
        product = bySku[0]
        knackRecordId = String(product.id || '')
      }
    }

    // If still not found, try direct Knack record ID lookup
    if (!product) {
      try {
        product = await getKnackRecord<Record<string, unknown>>(PRODUCTS_OBJECT_KEY, id)
        if (product) {
          knackRecordId = id
        }
      } catch {
        // Not a valid Knack record ID
      }
    }

    if (!product) {
      return NextResponse.json(
        { error: 'Product not found' },
        { status: 404 }
      )
    }

    // Get the product's ID field value for variant matching
    const productIdField = String(getFieldValue(product, PRODUCT_FIELDS.id, 'ID') || '')

    // Fetch all variants and match to this product
    const allVariants = await getKnackRecords<Record<string, unknown>>(VARIANTS_OBJECT_KEY, {
      sortField: VARIANT_FIELDS.sortOrder,
      sortOrder: 'asc',
    })

    const productVariants = []
    for (const variant of allVariants) {
      const productConnection = getFieldValue(variant, VARIANT_FIELDS.product, 'Product')
      const linkedProductId = extractProductIdFromConnection(productConnection)

      // Match by field_45 value or Knack record ID
      if (linkedProductId === productIdField || linkedProductId === knackRecordId) {
        productVariants.push({
          id: String(variant.id || ''),
          variantName: String(getFieldValue(variant, VARIANT_FIELDS.variantName, 'Variant Name') || ''),
          sku: String(getFieldValue(variant, VARIANT_FIELDS.sku, 'SKU') || ''),
          priceCny: Number(getFieldValue(variant, VARIANT_FIELDS.priceCny, 'Price CNY') || 0),
          priceCad: Number(getFieldValue(variant, VARIANT_FIELDS.priceCad, 'Selling Price') || 0),
          costCad: Number(getFieldValue(variant, VARIANT_FIELDS.costCad, 'Cost CAD') || 0),
          stock: getFieldValue(variant, VARIANT_FIELDS.stock, 'Stock'),
          status: String(getFieldValue(variant, VARIANT_FIELDS.status, 'Status') || 'Active'),
          sortOrder: Number(getFieldValue(variant, VARIANT_FIELDS.sortOrder, 'Sort Order') || 0),
          optionType1: String(getFieldValue(variant, VARIANT_FIELDS.optionType1, 'Option Type 1') || ''),
          optionValue1: String(getFieldValue(variant, VARIANT_FIELDS.optionValue1, 'Option Value 1') || ''),
          optionType2: String(getFieldValue(variant, VARIANT_FIELDS.optionType2, 'Option Type 2') || ''),
          optionValue2: String(getFieldValue(variant, VARIANT_FIELDS.optionValue2, 'Option Value 2') || ''),
          marginStandard: Number(getFieldValue(variant, VARIANT_FIELDS.marginStandard, 'Margin Standard') || 0),
          marginPromo: Number(getFieldValue(variant, VARIANT_FIELDS.marginPromo, 'Margin Promo') || 0),
          isAddonItem: getFieldValue(variant, VARIANT_FIELDS.isAddonItem, 'Is Add-on Item') === true ||
                       getFieldValue(variant, VARIANT_FIELDS.isAddonItem, 'Is Add-on Item') === 'Yes',
          addonPriceCad: Number(getFieldValue(variant, VARIANT_FIELDS.addonPriceCad, 'Add-on Price CAD') || 0),
        })
      }
    }

    // Sort variants by sortOrder
    productVariants.sort((a, b) => a.sortOrder - b.sortOrder)

    // Fetch images from object_14 (Product Images table) — grouped by imageType
    let primaryImage = ''
    const galleryImages: string[] = []
    let detailImage = ''

    try {
      const productImageRecords = await getKnackRecords<Record<string, unknown>>(
        PRODUCT_IMAGES_OBJECT_KEY,
        {
          filters: { [PRODUCT_IMAGE_FIELDS.product]: knackRecordId },
          sortField: PRODUCT_IMAGE_FIELDS.sortOrder,
          sortOrder: 'asc',
        }
      )

      for (const img of productImageRecords) {
        const imageType = String(getFieldValue(img, PRODUCT_IMAGE_FIELDS.imageType, 'Image Type') || '')
        const imageUrl = extractImageUrl(getFieldValue(img, PRODUCT_IMAGE_FIELDS.image, 'Image'))
        if (!imageUrl) continue

        if (imageType === 'Primary') {
          primaryImage = imageUrl
        } else if (imageType === 'Gallery') {
          galleryImages.push(imageUrl)
        } else if (imageType === 'Detail') {
          detailImage = imageUrl
        }
      }
    } catch (imgError) {
      console.error('[Admin API] Failed to fetch product images:', imgError)
    }

    // Build response
    // Strip HTML from description in case Knack returns rich text HTML (e.g. <p>...</p>)
    // Convert <br> / <p> boundaries to newlines so the admin textarea shows clean text
    const rawDescription = String(getFieldValue(product, PRODUCT_FIELDS.description, 'Description') || '')
    const plainDescription = rawDescription
      .replace(/<br\s*\/?>/gi, '\n')          // <br> → newline
      .replace(/<\/p>\s*<p[^>]*>/gi, '\n\n') // </p><p> → paragraph break
      .replace(/<[^>]+>/g, '')                  // strip remaining tags
      .replace(/&nbsp;/g, ' ')                  // decode common HTML entity
      .replace(/&amp;/g, '&')
      .replace(/&lt;/g, '<')
      .replace(/&gt;/g, '>')
      .replace(/&quot;/g, '"')
      .trim()

    const response = {
      id: String(getFieldValue(product, PRODUCT_FIELDS.id, 'ID') || knackRecordId),
      knackId: knackRecordId,
      sku: String(getFieldValue(product, PRODUCT_FIELDS.sku, 'SKU') || ''),
      title: String(getFieldValue(product, PRODUCT_FIELDS.title, 'Title') || ''),
      titleOriginal: String(getFieldValue(product, PRODUCT_FIELDS.titleOriginal, 'Title Original') || ''),
      description: plainDescription,
      category: String(getFieldValue(product, PRODUCT_FIELDS.category, 'Category') || ''),
      status: String(getFieldValue(product, PRODUCT_FIELDS.status, 'Status') || 'Draft'),
      priceCadBase: Number(getFieldValue(product, PRODUCT_FIELDS.priceCadBase, 'Price CAD Base') || 0),
      url: extractCleanUrl(getFieldValue(product, PRODUCT_FIELDS.url, 'URL')),
      primaryImage,
      images: galleryImages,
      detailImage,
      variants: productVariants,
    }

    return NextResponse.json(response)
  } catch (error) {
    console.error('[Admin API] Product fetch error:', error)
    return NextResponse.json(
      { error: 'Failed to fetch product' },
      { status: 500 }
    )
  }
}

// PUT /api/admin/products/[id] - Update a product
export async function PUT(
  request: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  try {
    const authCheck = await requireAdmin(request)
    if (authCheck instanceof NextResponse) return authCheck

    const { id } = await params
    const body = await request.json()

    // Find the product to get its Knack record ID
    let knackRecordId = ''

    // Try by ID field first
    const byIdField = await getKnackRecords<Record<string, unknown>>(PRODUCTS_OBJECT_KEY, {
      filters: { [PRODUCT_FIELDS.id]: id },
    })

    if (byIdField.length > 0) {
      knackRecordId = String(byIdField[0].id || '')
    }

    // Try by SKU
    if (!knackRecordId) {
      const bySku = await getKnackRecords<Record<string, unknown>>(PRODUCTS_OBJECT_KEY, {
        filters: { [PRODUCT_FIELDS.sku]: id },
      })
      if (bySku.length > 0) {
        knackRecordId = String(bySku[0].id || '')
      }
    }

    // Try direct Knack record ID
    if (!knackRecordId) {
      try {
        const direct = await getKnackRecord<Record<string, unknown>>(PRODUCTS_OBJECT_KEY, id)
        if (direct) {
          knackRecordId = id
        }
      } catch {
        // Not a valid Knack record ID
      }
    }

    if (!knackRecordId) {
      return NextResponse.json(
        { error: 'Product not found' },
        { status: 404 }
      )
    }

    // Build update data
    const updateData: Record<string, unknown> = {}

    if (body.title !== undefined) updateData[PRODUCT_FIELDS.title] = body.title
    if (body.titleOriginal !== undefined) updateData[PRODUCT_FIELDS.titleOriginal] = body.titleOriginal
    if (body.description !== undefined) updateData[PRODUCT_FIELDS.description] = body.description
    if (body.category !== undefined) updateData[PRODUCT_FIELDS.category] = body.category
    if (body.status !== undefined) updateData[PRODUCT_FIELDS.status] = body.status
    if (body.sku !== undefined) updateData[PRODUCT_FIELDS.sku] = body.sku
    if (body.url !== undefined) updateData[PRODUCT_FIELDS.url] = body.url
    if (body.priceCadBase !== undefined) updateData[PRODUCT_FIELDS.priceCadBase] = body.priceCadBase

    await updateKnackRecord(PRODUCTS_OBJECT_KEY, knackRecordId, updateData)

    return NextResponse.json({
      id,
      knackId: knackRecordId,
      message: 'Product updated successfully',
    })
  } catch (error) {
    console.error('[Admin API] Product update error:', error)
    return NextResponse.json(
      { error: 'Failed to update product' },
      { status: 500 }
    )
  }
}

// DELETE /api/admin/products/[id] - Delete a product
export async function DELETE(
  request: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  try {
    const authCheck = await requireAdmin(request)
    if (authCheck instanceof NextResponse) return authCheck

    const { id } = await params

    // Find the product to get its Knack record ID
    let knackRecordId = ''
    let productIdField = ''

    // Try by ID field first
    const byIdField = await getKnackRecords<Record<string, unknown>>(PRODUCTS_OBJECT_KEY, {
      filters: { [PRODUCT_FIELDS.id]: id },
    })

    if (byIdField.length > 0) {
      knackRecordId = String(byIdField[0].id || '')
      productIdField = String(getFieldValue(byIdField[0], PRODUCT_FIELDS.id, 'ID') || '')
    }

    // Try by SKU
    if (!knackRecordId) {
      const bySku = await getKnackRecords<Record<string, unknown>>(PRODUCTS_OBJECT_KEY, {
        filters: { [PRODUCT_FIELDS.sku]: id },
      })
      if (bySku.length > 0) {
        knackRecordId = String(bySku[0].id || '')
        productIdField = String(getFieldValue(bySku[0], PRODUCT_FIELDS.id, 'ID') || '')
      }
    }

    // Try direct Knack record ID
    if (!knackRecordId) {
      try {
        const direct = await getKnackRecord<Record<string, unknown>>(PRODUCTS_OBJECT_KEY, id)
        if (direct) {
          knackRecordId = id
          productIdField = String(getFieldValue(direct, PRODUCT_FIELDS.id, 'ID') || '')
        }
      } catch {
        // Not a valid Knack record ID
      }
    }

    if (!knackRecordId) {
      return NextResponse.json(
        { error: 'Product not found' },
        { status: 404 }
      )
    }

    // Delete all variants linked to this product first
    const allVariants = await getKnackRecords<Record<string, unknown>>(VARIANTS_OBJECT_KEY)

    for (const variant of allVariants) {
      const productConnection = getFieldValue(variant, VARIANT_FIELDS.product, 'Product')
      const linkedProductId = extractProductIdFromConnection(productConnection)

      if (linkedProductId === productIdField || linkedProductId === knackRecordId) {
        await deleteKnackRecord(VARIANTS_OBJECT_KEY, String(variant.id))
      }
    }

    // Delete the product
    await deleteKnackRecord(PRODUCTS_OBJECT_KEY, knackRecordId)

    return NextResponse.json({
      message: 'Product and its variants deleted successfully',
    })
  } catch (error) {
    console.error('[Admin API] Product delete error:', error)
    return NextResponse.json(
      { error: 'Failed to delete product' },
      { status: 500 }
    )
  }
}

// Helper to extract product ID from Knack connection field
function extractProductIdFromConnection(connection: unknown): string | null {
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
    return extractProductIdFromConnection(connection[0])
  }

  if (typeof connection === 'object' && connection !== null) {
    const obj = connection as Record<string, unknown>
    if (obj.id) return String(obj.id)
    if (obj.identifier) return String(obj.identifier)
  }

  return null
}

// Helper to extract image URL from Knack field
function extractImageUrl(imageField: unknown): string {
  if (!imageField) return ''

  if (typeof imageField === 'string') {
    try {
      const parsed = JSON.parse(imageField)
      return extractImageUrl(parsed)
    } catch {
      if (imageField.startsWith('http://') || imageField.startsWith('https://') || imageField.startsWith('/')) {
        return imageField
      }
      return imageField
    }
  }

  if (Array.isArray(imageField)) {
    if (imageField.length === 0) return ''
    return extractImageUrl(imageField[0])
  }

  if (typeof imageField === 'object' && imageField !== null) {
    const fileObj = imageField as Record<string, unknown>
    if (fileObj.url && typeof fileObj.url === 'string') return fileObj.url
    if (fileObj.file_url && typeof fileObj.file_url === 'string') return fileObj.file_url
    if (fileObj.link && typeof fileObj.link === 'string') return fileObj.link
    if (fileObj.src && typeof fileObj.src === 'string') return fileObj.src
    if (fileObj.raw && typeof fileObj.raw === 'string') return fileObj.raw
  }

  return ''
}

// Helper to extract multiple image URLs
function extractImageUrls(imagesField: unknown): string[] {
  if (!imagesField) return []

  if (typeof imagesField === 'string') {
    try {
      const parsed = JSON.parse(imagesField)
      return extractImageUrls(parsed)
    } catch {
      const url = extractImageUrl(imagesField)
      return url ? [url] : []
    }
  }

  if (Array.isArray(imagesField)) {
    return imagesField.map(item => extractImageUrl(item)).filter(Boolean)
  }

  const url = extractImageUrl(imagesField)
  return url ? [url] : []
}
