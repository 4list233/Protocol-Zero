import { NextRequest, NextResponse } from 'next/server'
import {
  getKnackRecord,
  updateKnackRecord,
  deleteKnackRecord,
} from '@/lib/knack-client'
import { KNACK_CONFIG, getFieldValue } from '@/lib/knack-config'

export const dynamic = 'force-dynamic'

const PRODUCT_IMAGES_OBJECT_KEY = KNACK_CONFIG.objectKeys.productImages
const IMAGE_FIELDS = KNACK_CONFIG.fields.productImages

// GET /api/admin/images/[id] - Get a single image
export async function GET(
  request: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  try {
    const { id } = await params

    const image = await getKnackRecord<Record<string, unknown>>(PRODUCT_IMAGES_OBJECT_KEY, id)

    if (!image) {
      return NextResponse.json(
        { error: 'Image not found' },
        { status: 404 }
      )
    }

    const response = {
      id: String(image.id || ''),
      name: String(getFieldValue(image, IMAGE_FIELDS.name, 'Name') || ''),
      productId: extractProductIdFromConnection(getFieldValue(image, IMAGE_FIELDS.product, 'Product')),
      imageUrl: extractImageUrl(getFieldValue(image, IMAGE_FIELDS.image, 'Image')),
      imageType: String(getFieldValue(image, IMAGE_FIELDS.imageType, 'Image Type') || 'Gallery'),
      sortOrder: Number(getFieldValue(image, IMAGE_FIELDS.sortOrder, 'Sort Order') || 0),
      altText: String(getFieldValue(image, IMAGE_FIELDS.altText, 'Alt Text') || ''),
      variantId: String(getFieldValue(image, IMAGE_FIELDS.variantId, 'Variant ID') || ''),
    }

    return NextResponse.json(response)
  } catch (error) {
    console.error('[Admin API] Image fetch error:', error)
    return NextResponse.json(
      { error: 'Failed to fetch image' },
      { status: 500 }
    )
  }
}

// PUT /api/admin/images/[id] - Update an image
export async function PUT(
  request: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  try {
    const { id } = await params
    const body = await request.json()

    // Verify image exists
    const image = await getKnackRecord<Record<string, unknown>>(PRODUCT_IMAGES_OBJECT_KEY, id)

    if (!image) {
      return NextResponse.json(
        { error: 'Image not found' },
        { status: 404 }
      )
    }

    // Build update data
    const updateData: Record<string, unknown> = {}

    if (body.name !== undefined) updateData[IMAGE_FIELDS.name] = body.name
    if (body.imageType !== undefined) updateData[IMAGE_FIELDS.imageType] = body.imageType
    if (body.sortOrder !== undefined) updateData[IMAGE_FIELDS.sortOrder] = body.sortOrder
    if (body.altText !== undefined) updateData[IMAGE_FIELDS.altText] = body.altText
    if (body.variantId !== undefined) updateData[IMAGE_FIELDS.variantId] = body.variantId

    await updateKnackRecord(PRODUCT_IMAGES_OBJECT_KEY, id, updateData)

    return NextResponse.json({
      id,
      message: 'Image updated successfully',
    })
  } catch (error) {
    console.error('[Admin API] Image update error:', error)
    return NextResponse.json(
      { error: 'Failed to update image' },
      { status: 500 }
    )
  }
}

// DELETE /api/admin/images/[id] - Delete an image
export async function DELETE(
  request: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  try {
    const { id } = await params

    // Verify image exists
    const image = await getKnackRecord<Record<string, unknown>>(PRODUCT_IMAGES_OBJECT_KEY, id)

    if (!image) {
      return NextResponse.json(
        { error: 'Image not found' },
        { status: 404 }
      )
    }

    await deleteKnackRecord(PRODUCT_IMAGES_OBJECT_KEY, id)

    return NextResponse.json({
      message: 'Image deleted successfully',
    })
  } catch (error) {
    console.error('[Admin API] Image delete error:', error)
    return NextResponse.json(
      { error: 'Failed to delete image' },
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
