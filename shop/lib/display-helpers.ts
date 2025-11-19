import type { Product } from './products'

export function getProductTitle(product: Product): string {
  return product.title
}

export function getProductImage(product: Product): string {
  return product.primaryImage || product.images?.[0] || '/images/placeholder.png'
}

export function formatPrice(amount: number): string {
  return `$${amount.toFixed(2)}`
}
