import { NextRequest, NextResponse } from 'next/server'
import { getKnackRecords, createKnackRecord } from '@/lib/knack-client'
import { KNACK_CONFIG, getFieldValue } from '@/lib/knack-config'
import { requireAdmin } from '@/lib/require-admin'

export const dynamic = 'force-dynamic'

const PRODUCTS_OBJECT_KEY = KNACK_CONFIG.objectKeys.products
const VARIANTS_OBJECT_KEY = KNACK_CONFIG.objectKeys.variants
const PRODUCT_FIELDS = KNACK_CONFIG.fields.products
const VARIANT_FIELDS = KNACK_CONFIG.fields.variants

// POST /api/admin/variants - Create a new variant
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

    if (!body.variantName) {
      return NextResponse.json(
        { error: 'Variant name is required' },
        { status: 400 }
      )
    }

    // Find the product's Knack record ID
    let productKnackId = ''

    // Try by ID field first
    const byIdField = await getKnackRecords<Record<string, unknown>>(PRODUCTS_OBJECT_KEY, {
      filters: { [PRODUCT_FIELDS.id]: body.productId },
    })

    if (byIdField.length > 0) {
      productKnackId = String(byIdField[0].id || '')
    }

    // Try by SKU
    if (!productKnackId) {
      const bySku = await getKnackRecords<Record<string, unknown>>(PRODUCTS_OBJECT_KEY, {
        filters: { [PRODUCT_FIELDS.sku]: body.productId },
      })
      if (bySku.length > 0) {
        productKnackId = String(bySku[0].id || '')
      }
    }

    // Try as direct Knack record ID
    if (!productKnackId) {
      // Assume it's a Knack record ID
      productKnackId = body.productId
    }

    if (!productKnackId) {
      return NextResponse.json(
        { error: 'Product not found' },
        { status: 404 }
      )
    }

    // Build variant data
    const variantData: Record<string, unknown> = {}
    variantData[VARIANT_FIELDS.product] = [productKnackId] // Knack connections are arrays
    variantData[VARIANT_FIELDS.variantName] = body.variantName
    variantData[VARIANT_FIELDS.sku] = body.sku || null
    variantData[VARIANT_FIELDS.priceCny] = body.priceCny || 0
    variantData[VARIANT_FIELDS.priceCad] = body.priceCad || 0
    variantData[VARIANT_FIELDS.costCad] = body.costCad || 0
    variantData[VARIANT_FIELDS.stock] = body.stock !== undefined ? body.stock : null
    variantData[VARIANT_FIELDS.status] = body.status || 'Active'
    variantData[VARIANT_FIELDS.sortOrder] = body.sortOrder || 0
    variantData[VARIANT_FIELDS.optionType1] = body.optionType1 || null
    variantData[VARIANT_FIELDS.optionValue1] = body.optionValue1 || null
    variantData[VARIANT_FIELDS.optionType2] = body.optionType2 || null
    variantData[VARIANT_FIELDS.optionValue2] = body.optionValue2 || null
    variantData[VARIANT_FIELDS.marginStandard] = body.marginStandard || null
    variantData[VARIANT_FIELDS.marginPromo] = body.marginPromo || null
    variantData[VARIANT_FIELDS.isAddonItem] = body.isAddonItem ? 'Yes' : 'No'
    variantData[VARIANT_FIELDS.addonPriceCad] = body.addonPriceCad || null

    const variantKnackId = await createKnackRecord(VARIANTS_OBJECT_KEY, variantData)

    return NextResponse.json({
      id: variantKnackId,
      message: 'Variant created successfully',
    }, { status: 201 })
  } catch (error) {
    console.error('[Admin API] Variant create error:', error)
    return NextResponse.json(
      { error: 'Failed to create variant' },
      { status: 500 }
    )
  }
}
