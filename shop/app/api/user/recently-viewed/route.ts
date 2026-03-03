import { NextRequest, NextResponse } from 'next/server'
import { getFirebaseAdminAuth } from '@/lib/firebase-admin'
import { saveUserData } from '@/lib/knack-users'

export const dynamic = 'force-dynamic'

/**
 * PUT /api/user/recently-viewed
 * Saves the logged-in user's recently viewed product IDs to Knack.
 * Requires: Authorization: Bearer <Firebase ID token>
 * Body: { productIds: string[] }  (max 20, most recent first)
 */
export async function PUT(request: NextRequest) {
  try {
    // Verify Firebase ID token
    const authHeader = request.headers.get('Authorization')
    if (!authHeader?.startsWith('Bearer ')) {
      return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })
    }

    const token = authHeader.slice(7)
    const adminAuth = getFirebaseAdminAuth()
    let uid: string

    try {
      const decoded = await adminAuth.verifyIdToken(token)
      uid = decoded.uid
    } catch {
      return NextResponse.json({ error: 'Invalid token' }, { status: 401 })
    }

    const body = await request.json()
    const productIds: string[] = Array.isArray(body.productIds) ? body.productIds : []

    // Keep max 20, most recent first
    const capped = productIds.slice(0, 20)

    await saveUserData(uid, { recentlyViewed: JSON.stringify(capped) })

    return NextResponse.json({ ok: true })
  } catch (error) {
    console.error('[User Recently Viewed API] Error:', error)
    return NextResponse.json({ error: 'Failed to save recently viewed' }, { status: 500 })
  }
}
