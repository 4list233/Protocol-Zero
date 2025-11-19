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
