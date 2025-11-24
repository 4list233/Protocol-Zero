import { fetchProducts } from './notion-client'
import type { ProductRuntime, ProductVariant } from './notion-client'

// Transform Notion products to admin table format
export async function fetchProductsFromNotion() {
  try {
    const products = await fetchProducts()
    
    // Transform to admin table format
    return products.map((product: ProductRuntime) => ({
      id: product.id,
      name: product.title,
      sku: product.sku,
      price_cad: product.price_cad,
      margin: product.margin,
      variants: (product.variants || []).map((variant: ProductVariant) => ({
        id: variant.id,
        name: variant.variantName,
        sku: variant.sku || '',
        priceYuan: variant.price_cny || 0,
        price_cad: variant.price_cad,
        margin: product.margin, // Use product margin for now
        stock: variant.stock,
        status: variant.status || 'Active',
      })),
    }))
  } catch (error) {
    console.error('Error fetching products from Notion:', error)
    // Return empty array on error so admin page still loads
    return []
  }
}
