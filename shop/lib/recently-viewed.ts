// Recently Viewed Products Management
// Tracks user's recently viewed products in localStorage
// For logged-in users, also syncs to Knack via /api/user/recently-viewed

const RECENTLY_VIEWED_KEY = "protocol-zero-recently-viewed"
const MAX_RECENTLY_VIEWED = 20 // Keep last 20 viewed products

/**
 * Add a product to recently viewed.
 * - Always writes to localStorage
 * - If getToken is provided (user logged in), also syncs to server (fire-and-forget)
 */
export function addRecentlyViewed(
  productId: string,
  getToken?: () => Promise<string | undefined>
): void {
  if (typeof window === "undefined") return

  try {
    const stored = localStorage.getItem(RECENTLY_VIEWED_KEY)
    const existing: string[] = stored ? JSON.parse(stored) : []

    // Move to front if already exists
    const filtered = existing.filter(id => id !== productId)
    const updated = [productId, ...filtered].slice(0, MAX_RECENTLY_VIEWED)

    localStorage.setItem(RECENTLY_VIEWED_KEY, JSON.stringify(updated))

    // Server sync for logged-in users (fire-and-forget)
    if (getToken) {
      getToken().then(token => {
        if (!token) return
        fetch('/api/user/recently-viewed', {
          method: 'PUT',
          headers: {
            'Content-Type': 'application/json',
            Authorization: `Bearer ${token}`,
          },
          body: JSON.stringify({ productIds: updated }),
        }).catch(() => {})
      }).catch(() => {})
    }
  } catch (error) {
    console.error("Failed to save recently viewed:", error)
  }
}

export function getRecentlyViewed(): string[] {
  if (typeof window === "undefined") return []

  try {
    const stored = localStorage.getItem(RECENTLY_VIEWED_KEY)
    return stored ? JSON.parse(stored) : []
  } catch (error) {
    console.error("Failed to load recently viewed:", error)
    return []
  }
}

/**
 * Replace the entire recently viewed list (used when loading from server on login).
 */
export function setRecentlyViewed(productIds: string[]): void {
  if (typeof window === "undefined") return
  try {
    localStorage.setItem(RECENTLY_VIEWED_KEY, JSON.stringify(productIds.slice(0, MAX_RECENTLY_VIEWED)))
  } catch {
    // Ignore storage errors
  }
}

export function clearRecentlyViewed(): void {
  if (typeof window === "undefined") return
  localStorage.removeItem(RECENTLY_VIEWED_KEY)
}
