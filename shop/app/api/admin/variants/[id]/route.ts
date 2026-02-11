import { NextRequest, NextResponse } from 'next/server'
import {
  getKnackRecord,
  updateKnackRecord,
  deleteKnackRecord,
} from '@/lib/knack-client'
import { KNACK_CONFIG, getFieldValue } from '@/lib/knack-config'

export const dynamic = 'force-dynamic'

const VARIANTS_OBJECT_KEY = KNACK_CONFIG.objectKeys.variants
const VARIANT_FIELDS = KNACK_CONFIG.fields.variants

// GET /api/admin/variants/[id] - Get a single variant
export async function GET(
  request: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  try {
    const { id } = await params

    const variant = await getKnackRecord<Record<string, unknown>>(VARIANTS_OBJECT_KEY, id)

    if (!variant) {
      return NextResponse.json(
        { error: 'Variant not found' },
        { status: 404 }
      )
    }

    const response = {
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
    }

    return NextResponse.json(response)
  } catch (error) {
    console.error('[Admin API] Variant fetch error:', error)
    return NextResponse.json(
      { error: 'Failed to fetch variant' },
      { status: 500 }
    )
  }
}

// PUT /api/admin/variants/[id] - Update a variant
export async function PUT(
  request: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  try {
    const { id } = await params
    const body = await request.json()

    // Verify variant exists
    const variant = await getKnackRecord<Record<string, unknown>>(VARIANTS_OBJECT_KEY, id)

    if (!variant) {
      return NextResponse.json(
        { error: 'Variant not found' },
        { status: 404 }
      )
    }

    // Build update data
    const updateData: Record<string, unknown> = {}

    if (body.variantName !== undefined) updateData[VARIANT_FIELDS.variantName] = body.variantName
    if (body.sku !== undefined) updateData[VARIANT_FIELDS.sku] = body.sku
    if (body.priceCny !== undefined) updateData[VARIANT_FIELDS.priceCny] = body.priceCny
    if (body.priceCad !== undefined) updateData[VARIANT_FIELDS.priceCad] = body.priceCad
    if (body.costCad !== undefined) updateData[VARIANT_FIELDS.costCad] = body.costCad
    if (body.stock !== undefined) updateData[VARIANT_FIELDS.stock] = body.stock
    if (body.status !== undefined) updateData[VARIANT_FIELDS.status] = body.status
    if (body.sortOrder !== undefined) updateData[VARIANT_FIELDS.sortOrder] = body.sortOrder
    if (body.optionType1 !== undefined) updateData[VARIANT_FIELDS.optionType1] = body.optionType1
    if (body.optionValue1 !== undefined) updateData[VARIANT_FIELDS.optionValue1] = body.optionValue1
    if (body.optionType2 !== undefined) updateData[VARIANT_FIELDS.optionType2] = body.optionType2
    if (body.optionValue2 !== undefined) updateData[VARIANT_FIELDS.optionValue2] = body.optionValue2
    if (body.marginStandard !== undefined) updateData[VARIANT_FIELDS.marginStandard] = body.marginStandard
    if (body.marginPromo !== undefined) updateData[VARIANT_FIELDS.marginPromo] = body.marginPromo
    if (body.isAddonItem !== undefined) updateData[VARIANT_FIELDS.isAddonItem] = body.isAddonItem ? 'Yes' : 'No'
    if (body.addonPriceCad !== undefined) updateData[VARIANT_FIELDS.addonPriceCad] = body.addonPriceCad

    await updateKnackRecord(VARIANTS_OBJECT_KEY, id, updateData)

    return NextResponse.json({
      id,
      message: 'Variant updated successfully',
    })
  } catch (error) {
    console.error('[Admin API] Variant update error:', error)
    return NextResponse.json(
      { error: 'Failed to update variant' },
      { status: 500 }
    )
  }
}

// DELETE /api/admin/variants/[id] - Delete a variant
export async function DELETE(
  request: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  try {
    const { id } = await params

    // Verify variant exists
    const variant = await getKnackRecord<Record<string, unknown>>(VARIANTS_OBJECT_KEY, id)

    if (!variant) {
      return NextResponse.json(
        { error: 'Variant not found' },
        { status: 404 }
      )
    }

    await deleteKnackRecord(VARIANTS_OBJECT_KEY, id)

    return NextResponse.json({
      message: 'Variant deleted successfully',
    })
  } catch (error) {
    console.error('[Admin API] Variant delete error:', error)
    return NextResponse.json(
      { error: 'Failed to delete variant' },
      { status: 500 }
    )
  }
}
