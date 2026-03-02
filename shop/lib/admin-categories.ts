// Admin category management
// Default categories are hardcoded; admins can add custom ones via the Settings page.
// Custom categories are stored in localStorage under STORAGE_KEY.

export const DEFAULT_CATEGORIES = [
  "Accessories",
  "Clothing",
  "Communications",
  "Eyewear",
  "Footwear",
  "Gloves",
  "Helmets",
  "Pouches",
  "Vests",
  "Other",
]

const STORAGE_KEY = 'pz_admin_categories'

/** Returns merged, sorted list of default + custom categories. Safe to call during SSR (returns defaults). */
export function getAdminCategories(): string[] {
  if (typeof window === 'undefined') return [...DEFAULT_CATEGORIES].sort()
  try {
    const stored = localStorage.getItem(STORAGE_KEY)
    const custom: string[] = stored ? JSON.parse(stored) : []
    return Array.from(new Set([...DEFAULT_CATEGORIES, ...custom])).sort()
  } catch {
    return [...DEFAULT_CATEGORIES].sort()
  }
}

/** Returns only the custom (non-default) categories saved by the admin. */
export function getCustomCategories(): string[] {
  if (typeof window === 'undefined') return []
  try {
    const stored = localStorage.getItem(STORAGE_KEY)
    return stored ? JSON.parse(stored) : []
  } catch {
    return []
  }
}

/** Saves a new custom category. No-op if it already exists or is a default. */
export function saveCustomCategory(category: string): void {
  if (typeof window === 'undefined') return
  const trimmed = category.trim()
  if (!trimmed) return
  try {
    const custom = getCustomCategories()
    if (!custom.includes(trimmed) && !DEFAULT_CATEGORIES.includes(trimmed)) {
      custom.push(trimmed)
      localStorage.setItem(STORAGE_KEY, JSON.stringify(custom))
    }
  } catch { /* ignore */ }
}

/** Removes a custom category. Default categories cannot be removed. */
export function removeCustomCategory(category: string): void {
  if (typeof window === 'undefined') return
  try {
    const custom = getCustomCategories().filter(c => c !== category)
    localStorage.setItem(STORAGE_KEY, JSON.stringify(custom))
  } catch { /* ignore */ }
}
