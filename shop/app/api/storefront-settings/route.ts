import { NextResponse } from 'next/server'
import { getStorefrontSettings } from '@/lib/storefront-settings'

// GET /api/storefront-settings - Public read-only endpoint for storefront config
export async function GET() {
  try {
    return NextResponse.json(getStorefrontSettings(), {
      headers: {
        'Cache-Control': 'public, s-maxage=60, stale-while-revalidate=300',
      },
    })
  } catch (error) {
    console.error('[API] Storefront settings fetch error:', error)
    return NextResponse.json({ error: 'Failed to fetch settings' }, { status: 500 })
  }
}
