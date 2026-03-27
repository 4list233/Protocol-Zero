import { NextRequest, NextResponse } from 'next/server'
import { requireAdmin } from '@/lib/require-admin'
import { getStorefrontSettings, updateStorefrontSettings } from '@/lib/storefront-settings'

export const dynamic = 'force-dynamic'

// GET /api/admin/settings - Get storefront settings (admin)
export async function GET(request: NextRequest) {
  try {
    const authCheck = await requireAdmin(request)
    if (authCheck instanceof NextResponse) return authCheck

    return NextResponse.json(getStorefrontSettings())
  } catch (error) {
    console.error('[API] Settings fetch error:', error)
    return NextResponse.json({ error: 'Failed to fetch settings' }, { status: 500 })
  }
}

// PUT /api/admin/settings - Update storefront settings (admin)
export async function PUT(request: NextRequest) {
  try {
    const authCheck = await requireAdmin(request)
    if (authCheck instanceof NextResponse) return authCheck

    const body = await request.json()
    const updates: Record<string, unknown> = {}

    if (typeof body.newArrivalsWindowDays === 'number' && body.newArrivalsWindowDays >= 0) {
      updates.newArrivalsWindowDays = body.newArrivalsWindowDays
    }
    if (Array.isArray(body.categoryDisplayOrder)) {
      updates.categoryDisplayOrder = body.categoryDisplayOrder.filter((s: unknown) => typeof s === 'string')
    }
    if (typeof body.rowSize === 'number' && body.rowSize >= 2 && body.rowSize <= 12) {
      updates.rowSize = body.rowSize
    }

    const updated = updateStorefrontSettings(updates)
    return NextResponse.json(updated)
  } catch (error) {
    console.error('[API] Settings update error:', error)
    return NextResponse.json({ error: 'Failed to update settings' }, { status: 500 })
  }
}
