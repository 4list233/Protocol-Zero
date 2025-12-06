// API Sanitizer - Remove sensitive business data before sending to public API responses
// This prevents exposing internal pricing, margins, and cost information

import type { ProductRuntime, ProductVariant } from './notion-client'

/**
 * Sanitized variant type for public API responses
 * Excludes CNY pricing, cost data, and margin information
 */
export type PublicProductVariant = Omit<ProductVariant, 
  | 'price_cny' 
  | 'addonCost' 
  | 'addonMargin'
>

/**
 * Sanitized product type for public API responses
 * Excludes margin and uses sanitized variants
 */
export type PublicProduct = Omit<ProductRuntime, 'margin' | 'variants'> & {
  variants?: PublicProductVariant[]
}

/**
 * Sanitize a single variant for public API response
 * Removes CNY pricing, cost data, and margin information
 */
export function sanitizeVariant(variant: ProductVariant): PublicProductVariant {
  const {
    price_cny,      // Remove CNY cost
    addonCost,      // Remove addon cost
    addonMargin,    // Remove addon margin
    ...publicVariant
  } = variant
  
  return publicVariant
}

/**
 * Sanitize a single product for public API response
 * Removes margin and sanitizes all variants
 */
export function sanitizeProduct(product: ProductRuntime): PublicProduct {
  const {
    margin,         // Remove margin percentage
    variants,
    ...publicProduct
  } = product
  
  return {
    ...publicProduct,
    variants: variants?.map(sanitizeVariant),
  }
}

/**
 * Sanitize an array of products for public API response
 */
export function sanitizeProducts(products: ProductRuntime[]): PublicProduct[] {
  return products.map(sanitizeProduct)
}
