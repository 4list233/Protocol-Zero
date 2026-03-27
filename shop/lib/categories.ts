// Category slug utilities, color mapping, and helpers for the storefront

export const CATEGORY_COLORS: Record<string, { gradient: string; accent: string }> = {
  accessories:    { gradient: 'from-amber-900/40 to-amber-800/20',    accent: '#D97706' },
  clothing:       { gradient: 'from-indigo-900/40 to-indigo-800/20',  accent: '#6366F1' },
  communications: { gradient: 'from-cyan-900/40 to-cyan-800/20',      accent: '#06B6D4' },
  eyewear:        { gradient: 'from-violet-900/40 to-violet-800/20',  accent: '#8B5CF6' },
  footwear:       { gradient: 'from-orange-900/40 to-orange-800/20',  accent: '#EA580C' },
  gloves:         { gradient: 'from-red-900/40 to-red-800/20',        accent: '#DC2626' },
  helmets:        { gradient: 'from-emerald-900/40 to-emerald-800/20',accent: '#059669' },
  pouches:        { gradient: 'from-teal-900/40 to-teal-800/20',      accent: '#0D9488' },
  vests:          { gradient: 'from-sky-900/40 to-sky-800/20',        accent: '#0284C7' },
  other:          { gradient: 'from-zinc-800/40 to-zinc-700/20',      accent: '#71717A' },
}

const FALLBACK_COLOR = { gradient: 'from-zinc-800/40 to-zinc-700/20', accent: '#71717A' }

/** Convert a category name to a URL-safe slug */
export function slugifyCategory(name: string): string {
  return name
    .toLowerCase()
    .replace(/\s+/g, '-')
    .replace(/[^a-z0-9-]/g, '')
}

/** Get the category name from a slug by matching against known products */
export function categoryFromSlug(slug: string, categoryNames: string[]): string | null {
  return categoryNames.find(name => slugifyCategory(name) === slug) || null
}

/** Get the gradient/accent color for a category */
export function getCategoryColor(categoryName: string): { gradient: string; accent: string } {
  const slug = slugifyCategory(categoryName)
  return CATEGORY_COLORS[slug] || FALLBACK_COLOR
}

/** Check if a product is "new" based on its created date and the window in days */
export function isProductNew(createdAt: string | undefined, windowDays: number): boolean {
  if (!createdAt || windowDays <= 0) return false
  const created = new Date(createdAt)
  if (isNaN(created.getTime())) return false
  const cutoff = new Date()
  cutoff.setDate(cutoff.getDate() - windowDays)
  return created >= cutoff
}
