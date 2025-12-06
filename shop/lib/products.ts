// Product types and data
export type Product = {
  id: string
  sku: string
  title: string
  price_cad: number
  // Primary image for listing cards
  primaryImage: string
  images: string[]
  detailLongImage?: string  // Stitched long detail image for scrolling
  url: string
  category?: string
  description?: string
  // Per-item adjustable margin (e.g., 0.35 => +35%)
  margin: number
  options?: {
    name: string
    values: string[]
  }[]
  variants?: {
    option: string
    price_cny: number
    price_cad: number
  }[]
}

// Prefer generated products if available (file is always present as placeholder)
import { generatedProducts } from './products.generated'

export const products: Product[] = generatedProducts

// Get product by ID
export function getProductById(id: string): Product | undefined {
  return products.find(p => p.id === id)
}

// Get products by category
export function getProductsByCategory(category: string): Product[] {
  return products.filter(p => p.category === category)
}

// Get featured products (first 3 for homepage)
export function getFeaturedProducts(count: number = 3): Product[] {
  return products.slice(0, count)
}

// ------------------------------
// Runtime Notion integration types/functions (non-breaking additions)
// ------------------------------

export type ProductVariant = {
  id: string
  variantName: string
  sku?: string
  price_cny: number
  price_cad?: number
  stock?: number
  status?: 'Active' | 'Out of Stock'
  sortOrder?: number
  // Multi-dimensional variant options (e.g., Color + Size)
  optionType1?: string   // e.g., "Color", "Style", "Material"
  optionValue1?: string  // e.g., "Black", "Standard", "Nylon"
  optionType2?: string   // e.g., "Size", "Length" (nullable)
  optionValue2?: string  // e.g., "M", "85-125cm" (nullable)
  // Add-on pricing (for items that are cheaper when added to another order)
  isAddonEligible?: boolean  // Can this variant be purchased as add-on?
  addonPrice?: number        // Discounted price when purchased as add-on
  addonCost?: number         // Cost basis for add-on pricing
  addonMargin?: number       // Margin % at add-on price
  minCartForAddon?: number   // Min cart value to unlock add-on pricing
}

export type RuntimeProduct = {
  id: string
  sku: string
  title: string
  title_original?: string
  price_cad: number
  margin: number
  primaryImage: string
  images: string[]
  detailLongImage?: string
  category?: string
  description?: string
  status?: 'Active' | 'Draft' | 'Discontinued' | 'Out of Stock'
  stock?: number
  url?: string
  variants?: ProductVariant[]
}

export async function getProductsRuntime(baseUrl?: string): Promise<RuntimeProduct[]> {
  const origin = baseUrl || process.env.NEXT_PUBLIC_BASE_URL || ''
  const res = await fetch(`${origin}/api/products`, { cache: 'no-store' })
  if (!res.ok) throw new Error('Failed to fetch products')
  return res.json()
}

export async function getProductRuntimeById(id: string, baseUrl?: string): Promise<RuntimeProduct | null> {
  const origin = baseUrl || process.env.NEXT_PUBLIC_BASE_URL || ''
  const res = await fetch(`${origin}/api/products/${id}`, { cache: 'no-store' })
  if (!res.ok) return null
  return res.json()
}
