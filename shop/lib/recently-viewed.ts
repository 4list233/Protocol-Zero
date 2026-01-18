// Recently Viewed Products Management
// Tracks user's recently viewed products in localStorage

const RECENTLY_VIEWED_KEY = "protocol-zero-recently-viewed"
const MAX_RECENTLY_VIEWED = 12 // Keep last 12 viewed products

export function addRecentlyViewed(productId: string): void {
  if (typeof window === "undefined") return
  
  try {
    const stored = localStorage.getItem(RECENTLY_VIEWED_KEY)
    const existing: string[] = stored ? JSON.parse(stored) : []
    
    // Remove if already exists (to move it to front)
    const filtered = existing.filter(id => id !== productId)
    
    // Add to front and limit to MAX
    const updated = [productId, ...filtered].slice(0, MAX_RECENTLY_VIEWED)
    
    localStorage.setItem(RECENTLY_VIEWED_KEY, JSON.stringify(updated))
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

export function clearRecentlyViewed(): void {
  if (typeof window === "undefined") return
  localStorage.removeItem(RECENTLY_VIEWED_KEY)
}
