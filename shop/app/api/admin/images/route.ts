import { NextRequest, NextResponse } from 'next/server'
import { getKnackRecords, createKnackRecord } from '@/lib/knack-client'
import { KNACK_CONFIG, getFieldValue } from '@/lib/knack-config'
import { requireAdmin } from '@/lib/require-admin'

export const dynamic = 'force-dynamic'

const PRODUCT_IMAGES_OBJECT_KEY = KNACK_CONFIG.objectKeys.productImages
const IMAGE_FIELDS = KNACK_CONFIG.fields.productImages

// GET /api/admin/images - List all images or filter by product
export async function GET(request: NextRequest) {
  try {
    const authCheck = await requireAdmin(request)
    if (authCheck instanceof NextResponse) return authCheck

    const searchParams = request.nextUrl.searchParams
    const productId = searchParams.get('productId')

    // Build filters
    const filters: Record<string, unknown> = {}
    if (productId) {
      filters[IMAGE_FIELDS.product] = productId
    }

    // Fetch images
    const images = await getKnackRecords<Record<string, unknown>>(PRODUCT_IMAGES_OBJECT_KEY, {
      filters: Object.keys(filters).length > 0 ? filters : undefined,
      sortField: IMAGE_FIELDS.sortOrder,
      sortOrder: 'asc',
    })

    // Map to response format
    const mappedImages = images.map(img => ({
      id: String(img.id || ''),
      name: String(getFieldValue(img, IMAGE_FIELDS.name, 'Name') || ''),
      productId: extractProductIdFromConnection(getFieldValue(img, IMAGE_FIELDS.product, 'Product')),
      imageUrl: extractImageUrl(getFieldValue(img, IMAGE_FIELDS.image, 'Image')),
      imageType: String(getFieldValue(img, IMAGE_FIELDS.imageType, 'Image Type') || 'Gallery'),
      sortOrder: Number(getFieldValue(img, IMAGE_FIELDS.sortOrder, 'Sort Order') || 0),
      altText: String(getFieldValue(img, IMAGE_FIELDS.altText, 'Alt Text') || ''),
      variantId: String(getFieldValue(img, IMAGE_FIELDS.variantId, 'Variant ID') || ''),
    }))

    return NextResponse.json({
      images: mappedImages,
      total: mappedImages.length,
    })
  } catch (error) {
    console.error('[Admin API] Images list error:', error)
    return NextResponse.json(
      { error: 'Failed to fetch images' },
      { status: 500 }
    )
  }
}

// POST /api/admin/images - Create a new image record
export async function POST(request: NextRequest) {
  try {
    const authCheck = await requireAdmin(request)
    if (authCheck instanceof NextResponse) return authCheck

    const body = await request.json()

    // Validate required fields
    if (!body.productId) {
      return NextResponse.json(
        { error: 'Product ID is required' },
        { status: 400 }
      )
    }

    if (!body.imageUrl && !body.image) {
      return NextResponse.json(
        { error: 'Image URL or image data is required' },
        { status: 400 }
      )
    }

    // Build image data
    const imageData: Record<string, unknown> = {}
    imageData[IMAGE_FIELDS.name] = body.name || `Image ${Date.now()}`
    imageData[IMAGE_FIELDS.product] = [body.productId] // Knack connections are arrays
    imageData[IMAGE_FIELDS.imageType] = body.imageType || 'Gallery'
    imageData[IMAGE_FIELDS.sortOrder] = body.sortOrder || 0
    imageData[IMAGE_FIELDS.altText] = body.altText || null
    imageData[IMAGE_FIELDS.variantId] = body.variantId || null

    // If imageUrl is provided, we need to handle it based on Knack's requirements
    // For now, store URL in a way Knack can use
    if (body.imageUrl) {
      // Knack image fields expect a file upload, not a URL
      // For URL-based images, we might need to store differently
      imageData[IMAGE_FIELDS.image] = body.imageUrl
    }

    const imageKnackId = await createKnackRecord(PRODUCT_IMAGES_OBJECT_KEY, imageData)

    return NextResponse.json({
      id: imageKnackId,
      message: 'Image record created successfully',
    }, { status: 201 })
  } catch (error) {
    console.error('[Admin API] Image create error:', error)
    return NextResponse.json(
      { error: 'Failed to create image' },
      { status: 500 }
    )
  }
}

// Helper to extract product ID from Knack connection field
function extractProductIdFromConnection(connection: unknown): string | null {
  if (typeof connection === 'string') {
    if (connection.includes('<') && connection.includes('>')) {
      const classMatch = connection.match(/class="([a-f0-9]{24})"/)
      if (classMatch && classMatch[1]) return classMatch[1]
      const match = connection.match(/data-kn="connection-value">([^<]+)</) ||
                   connection.match(/>([^<]+)</)
      if (match && match[1]) return match[1].trim()
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
