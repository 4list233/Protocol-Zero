import { NextResponse } from 'next/server'
import { getKnackRecords } from '@/lib/knack-client'
import { KNACK_CONFIG } from '@/lib/knack-config'

export const dynamic = 'force-dynamic'

/**
 * GET /api/promo/validate?code=PJAD
 * Validates a promo code against Knack database
 */
export async function GET(request: Request) {
  try {
    const { searchParams } = new URL(request.url)
    const code = searchParams.get('code')
    
    if (!code) {
      return NextResponse.json(
        { error: 'Promo code is required' },
        { status: 400 }
      )
    }
    
    const PROMO_FIELDS = KNACK_CONFIG.fields.promoCodes
    const PROMO_OBJECT_KEY = PROMO_FIELDS.objectKey
    
    if (!PROMO_OBJECT_KEY) {
      return NextResponse.json(
        { error: 'Promo codes not configured' },
        { status: 500 }
      )
    }
    
    // Search for promo code in Knack
    const normalizedCode = code.toUpperCase()
    console.log(`[Promo Validate] Looking for code: ${normalizedCode}`)
    console.log(`[Promo Validate] Object: ${PROMO_OBJECT_KEY}, Field: ${PROMO_FIELDS.code}`)
    
    const records = await getKnackRecords<Record<string, unknown>>(PROMO_OBJECT_KEY, {
      filters: { [PROMO_FIELDS.code]: normalizedCode },
      perPage: 1,
    })
    
    console.log(`[Promo Validate] Found ${records.length} record(s)`)
    
    if (records.length === 0) {
      console.log(`[Promo Validate] Code "${normalizedCode}" not found in Knack`)
      return NextResponse.json({
        valid: false,
        code: normalizedCode,
        message: 'Invalid promo code',
      })
    }
    
    const promo = records[0]
    const isActive = promo[PROMO_FIELDS.isActive] === true || 
                     promo[PROMO_FIELDS.isActive] === 'Yes' ||
                     promo[PROMO_FIELDS.isActive] === 'yes'
    
    if (!isActive) {
      return NextResponse.json({
        valid: false,
        code: code.toUpperCase(),
        message: 'This promo code is no longer active',
      })
    }
    
    const discountPercent = Number(promo[PROMO_FIELDS.discountPercent] || 0)
    
    return NextResponse.json({
      valid: true,
      code: code.toUpperCase(),
      discount: discountPercent / 100, // Convert to decimal (10% -> 0.10)
      message: `${discountPercent}% discount applied`,
    }, {
      headers: {
        'Cache-Control': 'public, s-maxage=60, stale-while-revalidate=120',
      },
    })
    
  } catch (error) {
    console.error('Error validating promo code:', error)
    return NextResponse.json(
      { error: 'Failed to validate promo code' },
      { status: 500 }
    )
  }
}

