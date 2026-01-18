// Wishlist Management
// Allows users to save favorite products

const WISHLIST_KEY = "protocol-zero-wishlist"

export function addToWishlist(productId: string): void {
  if (typeof window === "undefined") return
  
  try {
    const stored = localStorage.getItem(WISHLIST_KEY)
    const existing: string[] = stored ? JSON.parse(stored) : []
    
    if (!existing.includes(productId)) {
      existing.push(productId)
      localStorage.setItem(WISHLIST_KEY, JSON.stringify(existing))
      window.dispatchEvent(new CustomEvent("wishlistUpdated", { detail: { added: productId } }))
    }
  } catch (error) {
    console.error("Failed to add to wishlist:", error)
  }
}

export function removeFromWishlist(productId: string): void {
  if (typeof window === "undefined") return
  
  try {
    const stored = localStorage.getItem(WISHLIST_KEY)
    const existing: string[] = stored ? JSON.parse(stored) : []
    
    const filtered = existing.filter(id => id !== productId)
    localStorage.setItem(WISHLIST_KEY, JSON.stringify(filtered))
    window.dispatchEvent(new CustomEvent("wishlistUpdated", { detail: { removed: productId } }))
  } catch (error) {
    console.error("Failed to remove from wishlist:", error)
  }
}

export function isInWishlist(productId: string): boolean {
  if (typeof window === "undefined") return false
  
  try {
    const stored = localStorage.getItem(WISHLIST_KEY)
    const existing: string[] = stored ? JSON.parse(stored) : []
    return existing.includes(productId)
  } catch (error) {
    console.error("Failed to check wishlist:", error)
    return false
  }
}

export function getWishlist(): string[] {
  if (typeof window === "undefined") return []
  
  try {
    const stored = localStorage.getItem(WISHLIST_KEY)
    return stored ? JSON.parse(stored) : []
  } catch (error) {
    console.error("Failed to load wishlist:", error)
    return []
  }
}

export function clearWishlist(): void {
  if (typeof window === "undefined") return
  localStorage.removeItem(WISHLIST_KEY)
  window.dispatchEvent(new CustomEvent("wishlistUpdated", { detail: { cleared: true } }))
}
