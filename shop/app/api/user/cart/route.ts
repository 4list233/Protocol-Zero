import { NextRequest, NextResponse } from 'next/server'
import { getFirebaseAdminAuth } from '@/lib/firebase-admin'
import { saveUserData } from '@/lib/knack-users'
import type { CartItem } from '@/lib/cart-context'

export const dynamic = 'force-dynamic'

/**
 * PUT /api/user/cart
 * Saves the logged-in user's cart to Knack.
 * Requires: Authorization: Bearer <Firebase ID token>
 * Body: { items: CartItem[] }
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
    const items: CartItem[] = Array.isArray(body.items) ? body.items : []

    // Cap at 50 items to keep JSON size reasonable
    const capped = items.slice(0, 50)

    await saveUserData(uid, { cartJson: JSON.stringify(capped) })

    return NextResponse.json({ ok: true })
  } catch (error) {
    console.error('[User Cart API] Error:', error)
    return NextResponse.json({ error: 'Failed to save cart' }, { status: 500 })
  }
}
