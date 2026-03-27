// Knack is the primary data source for products and variants.
import * as knackProducts from './knack-products'

export type ProductVariant = {
  id: string
  variantName: string
  sku?: string
  price_cny: number
  cost_cad?: number
  price_cad?: number
  margin?: number
  margin_promo?: number
  stock?: number
  status?: 'Active' | 'Out of Stock'
  sortOrder?: number
  optionType1?: string
  optionValue1?: string
  optionType2?: string
  optionValue2?: string
  isAddonEligible?: boolean
  addonPrice?: number
  addonCost?: number
  addonMargin?: number
  minCartForAddon?: number
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
  variantImages?: Record<string, string>
  category?: string
  description?: string
  status?: 'Active' | 'Draft' | 'Discontinued' | 'Out of Stock'
  stock?: number
  url?: string
  createdAt?: string
  variants?: ProductVariant[]
}

export async function fetchProducts(): Promise<ProductRuntime[]> {
  return await knackProducts.fetchProducts()
}

export async function fetchProductById(id: string): Promise<ProductRuntime | null> {
  return await knackProducts.fetchProductById(id)
}

