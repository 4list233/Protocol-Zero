// Knack is the primary data source for products and variants
// Notion is only used for images (handled in knack-products.ts)
import * as knackProducts from './knack-products'

// Type exports (re-export from knack-products)
export type ProductVariant = {
  id: string
  variantName: string
  sku?: string
  price_cny: number
  price_cad?: number
  stock?: number
  status?: 'Active' | 'Out of Stock'
  sortOrder?: number
}

export type ProductRuntime = {
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

// Always use Knack for products and variants
export async function fetchProducts(): Promise<ProductRuntime[]> {
  return await knackProducts.fetchProducts()
}

export async function fetchProductById(id: string): Promise<ProductRuntime | null> {
  return await knackProducts.fetchProductById(id)
}
