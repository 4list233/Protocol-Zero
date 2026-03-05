import { NextRequest, NextResponse } from 'next/server'
import { getFirebaseAdminAuth } from '@/lib/firebase-admin'
import {
  getCartByAnonymousId,
  getCartByFirebaseUid,
  createCart,
  updateCartItems,
  updateCartStatus,
  mergeCarts,
} from '@/lib/knack-carts'
import { getAnonymousCartId, clearAnonymousCartId } from '@/lib/cart-identity'
import type { CartItem } from '@/lib/cart-context'

export const dynamic = 'force-dynamic'

/**
 * POST /api/cart/merge
 * Called once after login. Merges anonymous guest cart + localStorage
 * items with the user's existing server cart.
 *
 * Body: { localItems?: CartItem[] }
 * Returns: { items: CartItem[] } — the merged cart.
 */
export async function POST(request: NextRequest) {
  try {
    // Require auth
    const authHeader = request.headers.get('Authorization')
    if (!authHeader?.startsWith('Bearer ')) {
      return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })
    }

    const token = authHeader.slice(7)
    const adminAuth = getFirebaseAdminAuth()
    let firebaseUid: string

    try {
      const decoded = await adminAuth.verifyIdToken(token)
      firebaseUid = decoded.uid
    } catch {
      return NextResponse.json({ error: 'Invalid token' }, { status: 401 })
    }

    const body = await request.json().catch(() => ({}))
    const localItems: CartItem[] = Array.isArray(body.localItems) ? body.localItems : []

    // Get the user's existing server cart
    const { cart: userCart, knackUserId } = await getCartByFirebaseUid(firebaseUid)
    const userItems = userCart?.items || []

    // Get the anonymous guest cart (if cookie exists)
    const anonId = await getAnonymousCartId()
    let anonCart = null
    if (anonId) {
      anonCart = await getCartByAnonymousId(anonId)
    }
    const anonItems = anonCart?.items || []

    // Merge all three sources: user cart + anonymous cart + localStorage
    let merged = mergeCarts(userItems, anonItems)
    if (localItems.length > 0) {
      merged = mergeCarts(merged, localItems)
    }

    // Save merged cart to user's cart record
    if (userCart) {
      await updateCartItems(userCart.id, merged, {
        knackUserId: knackUserId || undefined,
      })
    } else if (merged.length > 0 && knackUserId) {
      await createCart({
        knackUserId,
        items: merged,
      })
    }

    // Expire the anonymous cart
    if (anonCart) {
      await updateCartStatus(anonCart.id, 'Expired')
    }

    // Clear the anonymous cookie
    await clearAnonymousCartId()

    return NextResponse.json({ items: merged })
  } catch (error) {
    console.error('[Cart Merge API] Error:', error)
    return NextResponse.json({ error: 'Failed to merge carts' }, { status: 500 })
  }
}
