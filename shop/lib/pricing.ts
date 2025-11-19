import type { Product } from './products'

export function getProductPrice(product: Product, selectedVariantOption?: string): number {
  let base = product.price_cad || 0
  if (selectedVariantOption && product.variants && product.variants.length) {
    const v = product.variants.find(v => v.option === selectedVariantOption)
    if (v && v.price_cad > 0) base = v.price_cad
  }
  const margin = product.margin ?? 0
  const price = base * (1 + margin)
  return Math.round(price * 100) / 100
}
