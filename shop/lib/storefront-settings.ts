// Storefront settings — server-side config that affects all visitors
// Stored as a JSON file in the project (could migrate to Knack later)
// These are read by the public API and written by admin

export type StorefrontSettings = {
  /** Number of days a product is considered "new" */
  newArrivalsWindowDays: number
  /** Ordered list of category slugs for display priority (first = top row) */
  categoryDisplayOrder: string[]
  /** Max products per category row on desktop */
  rowSize: number
}

export const DEFAULT_STOREFRONT_SETTINGS: StorefrontSettings = {
  newArrivalsWindowDays: 30,
  categoryDisplayOrder: [],
  rowSize: 6,
}

// In-memory cache for settings (resets on cold start, refreshed via API)
let settingsCache: StorefrontSettings | null = null

/** Get current storefront settings */
export function getStorefrontSettings(): StorefrontSettings {
  return settingsCache || { ...DEFAULT_STOREFRONT_SETTINGS }
}

/** Update storefront settings (called by admin API) */
export function updateStorefrontSettings(updates: Partial<StorefrontSettings>): StorefrontSettings {
  const current = getStorefrontSettings()
  const updated = { ...current, ...updates }
  settingsCache = updated
  return updated
}
