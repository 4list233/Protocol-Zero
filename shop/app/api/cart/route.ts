import { NextRequest, NextResponse } from 'next/server'
import { getFirebaseAdminAuth } from '@/lib/firebase-admin'
import { getAnonymousCartId, getOrCreateAnonymousCartId } from '@/lib/cart-identity'
import {
  getCartByAnonymousId,
  getCartByFirebaseUid,
  createCart,
  updateCartItems,
  updateCartStatus,
} from '@/lib/knack-carts'
import type { CartItem } from '@/lib/cart-context'

export const dynamic = 'force-dynamic'

/**
 * Attempt to extract Firebase UID from Authorization header.
 * Returns null if no valid token (guest user).
 */
async function getFirebaseUid(request: NextRequest): Promise<string | null> {
  const authHeader = request.headers.get('Authorization')
  if (!authHeader?.startsWith('Bearer ')) return null

  try {
    const token = authHeader.slice(7)
    const adminAuth = getFirebaseAdminAuth()
    const decoded = await adminAuth.verifyIdToken(token)
    return decoded.uid
  } catch {
    return null
  }
}

// =============================================================================
// GET /api/cart — Load the current user's cart
// =============================================================================
export async function GET(request: NextRequest) {
  try {
    const firebaseUid = await getFirebaseUid(request)

    if (firebaseUid) {
      // Logged-in user: find cart by Firebase UID → Knack user
      const { cart } = await getCartByFirebaseUid(firebaseUid)
      return NextResponse.json({
        items: cart?.items || [],
        cartId: cart?.id || null,
        status: cart?.status || null,
      })
    }

    // Guest: find cart by anonymous cookie
    const anonId = await getAnonymousCartId()
    if (!anonId) {
      return NextResponse.json({ items: [], cartId: null, status: null })
    }

    const cart = await getCartByAnonymousId(anonId)
    return NextResponse.json({
      items: cart?.items || [],
      cartId: cart?.id || null,
      status: cart?.status || null,
    })
  } catch (error) {
    console.error('[Cart API GET] Error:', error)
    return NextResponse.json({ error: 'Failed to load cart' }, { status: 500 })
  }
}

// =============================================================================
// PUT /api/cart — Save/update the current user's cart
// =============================================================================
export async function PUT(request: NextRequest) {
  try {
    const body = await request.json()
    const items: CartItem[] = Array.isArray(body.items) ? body.items.slice(0, 50) : []

    const firebaseUid = await getFirebaseUid(request)

    if (firebaseUid) {
      // Logged-in user
      const { cart, knackUserId } = await getCartByFirebaseUid(firebaseUid)

      if (cart) {
        await updateCartItems(cart.id, items)
      } else if (items.length > 0) {
        await createCart({
          knackUserId: knackUserId || undefined,
          items,
        })
      }

      return NextResponse.json({ ok: true })
    }

    // Guest user: use anonymous cookie
    const anonId = await getOrCreateAnonymousCartId()
    const cart = await getCartByAnonymousId(anonId)

    if (cart) {
      await updateCartItems(cart.id, items)
    } else if (items.length > 0) {
      await createCart({ anonymousId: anonId, items })
    }

    return NextResponse.json({ ok: true })
  } catch (error) {
    console.error('[Cart API PUT] Error:', error)
    return NextResponse.json({ error: 'Failed to save cart' }, { status: 500 })
  }
}

// =============================================================================
// DELETE /api/cart — Clear the current user's cart (mark as Expired)
// =============================================================================
export async function DELETE(request: NextRequest) {
  try {
    const firebaseUid = await getFirebaseUid(request)

    if (firebaseUid) {
      const { cart } = await getCartByFirebaseUid(firebaseUid)
      if (cart) {
        await updateCartStatus(cart.id, 'Expired')
      }
      return NextResponse.json({ ok: true })
    }

    const anonId = await getAnonymousCartId()
    if (anonId) {
      const cart = await getCartByAnonymousId(anonId)
      if (cart) {
        await updateCartStatus(cart.id, 'Expired')
      }
    }

    return NextResponse.json({ ok: true })
  } catch (error) {
    console.error('[Cart API DELETE] Error:', error)
    return NextResponse.json({ error: 'Failed to clear cart' }, { status: 500 })
  }
}
