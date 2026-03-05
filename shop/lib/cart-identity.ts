import { cookies } from 'next/headers'

const CART_COOKIE_NAME = 'pz-cart-id'
const CART_COOKIE_MAX_AGE = 90 * 24 * 60 * 60 // 90 days in seconds

/**
 * Get the anonymous cart ID from the request cookie.
 * Returns null if no cookie exists.
 */
export async function getAnonymousCartId(): Promise<string | null> {
  const cookieStore = await cookies()
  const cookie = cookieStore.get(CART_COOKIE_NAME)
  return cookie?.value || null
}

/**
 * Get or create an anonymous cart ID.
 * If no cookie exists, generates a new UUID and sets it.
 * Returns the anonymous cart ID.
 */
export async function getOrCreateAnonymousCartId(): Promise<string> {
  const cookieStore = await cookies()
  const existing = cookieStore.get(CART_COOKIE_NAME)

  if (existing?.value) {
    return existing.value
  }

  const newId = crypto.randomUUID()
  cookieStore.set(CART_COOKIE_NAME, newId, {
    httpOnly: true,
    secure: process.env.NODE_ENV === 'production',
    sameSite: 'lax',
    maxAge: CART_COOKIE_MAX_AGE,
    path: '/',
  })

  return newId
}

/**
 * Clear the anonymous cart cookie (e.g., after merge on login).
 */
export async function clearAnonymousCartId(): Promise<void> {
  const cookieStore = await cookies()
  cookieStore.delete(CART_COOKIE_NAME)
}
