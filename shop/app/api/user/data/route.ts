import { NextRequest, NextResponse } from 'next/server'
import { getFirebaseAdminAuth } from '@/lib/firebase-admin'
import { loadUserData } from '@/lib/knack-users'
import type { CartItem } from '@/lib/cart-context'

export const dynamic = 'force-dynamic'

/**
 * GET /api/user/data
 * Returns the logged-in user's persisted cart and recently viewed product IDs.
 * Requires: Authorization: Bearer <Firebase ID token>
 */
export async function GET(request: NextRequest) {
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

    // Load from Knack
    const data = await loadUserData(uid)

    // Parse cart JSON
    let cart: CartItem[] = []
    if (data.cartJson) {
      try {
        const parsed = JSON.parse(data.cartJson)
        if (Array.isArray(parsed)) cart = parsed
      } catch {
        // Corrupt data — return empty
      }
    }

    // Parse recently viewed JSON
    let recentlyViewed: string[] = []
    if (data.recentlyViewed) {
      try {
        const parsed = JSON.parse(data.recentlyViewed)
        if (Array.isArray(parsed)) recentlyViewed = parsed
      } catch {
        // Corrupt data — return empty
      }
    }

    return NextResponse.json({ cart, recentlyViewed })
  } catch (error) {
    console.error('[User Data API] Error:', error)
    return NextResponse.json({ error: 'Failed to load user data' }, { status: 500 })
  }
}
