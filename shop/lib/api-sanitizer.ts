// API Sanitizer - Remove sensitive business data and internal fields before sending to public API responses
// This prevents exposing internal pricing, margins, cost information, and data not displayed on pages

import type { ProductRuntime, ProductVariant } from './notion-client'

/**
 * Sanitized variant type for public API responses
 * Excludes CNY pricing, cost data, margin information, and internal fields
 */
export type PublicProductVariant = Omit<ProductVariant, 
  | 'price_cny'      // Remove CNY cost (sensitive)
  | 'addonCost'      // Remove addon cost (sensitive)
  | 'addonMargin'    // Remove addon margin (sensitive)
  | 'sortOrder'      // Remove internal ordering (not displayed)
  | 'status'         // Remove internal status (not displayed)
  | 'minCartForAddon' // Remove internal logic field (not used in frontend)
>

/**
 * Sanitized product type for public API responses
 * Excludes margin, internal fields, and uses sanitized variants
 */
export type PublicProduct = Omit<ProductRuntime, 
  | 'margin'         // Remove margin percentage (sensitive)
  | 'title_original' // Remove Chinese title (not displayed)
  | 'url'            // Remove Taobao URL (not displayed, contains sensitive links)
  | 'status'         // Remove internal status (not displayed)
  | 'stock'          // Remove product-level stock (only variant stock is used)
  | 'price_cad'      // Remove product-level price (always 0, only variant prices used)
  | 'variants'
> & {
  variants?: PublicProductVariant[]
}

/**
 * Sanitize a single variant for public API response
 * Removes CNY pricing, cost data, margin information, and internal fields
 */
export function sanitizeVariant(variant: ProductVariant): PublicProductVariant {
  const {
    price_cny,        // Remove CNY cost (sensitive)
    addonCost,        // Remove addon cost (sensitive)
    addonMargin,      // Remove addon margin (sensitive)
    sortOrder,        // Remove internal ordering (not displayed)
    status,           // Remove internal status (not displayed)
    minCartForAddon,  // Remove internal logic field (not used in frontend)
    ...publicVariant
  } = variant
  
  return publicVariant
}

/**
 * Sanitize a single product for public API response
 * Removes margin, internal fields, and sanitizes all variants
 */
export function sanitizeProduct(product: ProductRuntime): PublicProduct {
  const {
    margin,           // Remove margin percentage (sensitive)
    title_original,   // Remove Chinese title (not displayed)
    url,              // Remove Taobao URL (not displayed, contains sensitive links)
    status,           // Remove internal status (not displayed)
    stock,            // Remove product-level stock (only variant stock is used)
    price_cad,        // Remove product-level price (always 0, only variant prices used)
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
