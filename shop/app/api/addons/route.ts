import { NextResponse } from 'next/server'
import { fetchProducts } from '@/lib/knack-products'

export const dynamic = 'force-dynamic'

export type AddonItem = {
  productId: string
  productTitle: string
  productImage: string
  variantId: string
  variantTitle: string
  sku?: string
  regularPrice: number
  addonPrice: number
  savings: number
  savingsPercent: number
}

/**
 * GET /api/addons
 * Returns all variants that are eligible for add-on pricing
 */
export async function GET() {
  try {
    const products = await fetchProducts()
    
    const addonItems: AddonItem[] = []
    
    for (const product of products) {
      if (!product.variants) continue
      
      for (const variant of product.variants) {
        // Check if this variant is eligible for add-on pricing
        if (variant.isAddonEligible && variant.addonPrice && variant.price_cad) {
          const savings = variant.price_cad - variant.addonPrice
          const savingsPercent = Math.round((savings / variant.price_cad) * 100)
          
          addonItems.push({
            productId: product.id,
            productTitle: product.title,
            productImage: product.primaryImage,
            variantId: variant.id,
            variantTitle: variant.variantName,
            sku: variant.sku,
            regularPrice: variant.price_cad,
            addonPrice: variant.addonPrice,
            savings,
            savingsPercent,
          })
        }
      }
    }
    
    // Sort by savings percentage (best deals first)
    addonItems.sort((a, b) => b.savingsPercent - a.savingsPercent)
    
    return NextResponse.json({
      items: addonItems,
      count: addonItems.length,
    }, {
      headers: {
        'Cache-Control': 'public, s-maxage=60, stale-while-revalidate=120',
      },
    })
  } catch (error) {
    console.error('Error fetching addon items:', error)
    return NextResponse.json(
      { error: 'Failed to fetch addon items' },
      { status: 500 }
    )
  }
}

