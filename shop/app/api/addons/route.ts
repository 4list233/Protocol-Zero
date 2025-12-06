import { NextResponse } from 'next/server'
import { fetchProducts } from '@/lib/knack-products'

export const dynamic = 'force-dynamic'

// Allowed origins for addon API access
const ALLOWED_ORIGINS = [
  'https://pzairsoft.ca',
  'https://www.pzairsoft.ca',
  'https://protocol-zero.vercel.app',
  process.env.NEXT_PUBLIC_BASE_URL,
].filter(Boolean)

// In development, allow localhost
if (process.env.NODE_ENV === 'development') {
  ALLOWED_ORIGINS.push('http://localhost:3000', 'http://127.0.0.1:3000')
}

function isRequestFromAllowedOrigin(request: Request): boolean {
  const origin = request.headers.get('origin')
  const referer = request.headers.get('referer')
  
  // Check origin header
  if (origin && ALLOWED_ORIGINS.includes(origin)) {
    return true
  }
  
  // Check referer header (for same-origin requests, origin might be null)
  if (referer) {
    try {
      const refererUrl = new URL(referer)
      const refererOrigin = refererUrl.origin
      if (ALLOWED_ORIGINS.includes(refererOrigin)) {
        return true
      }
    } catch {
      // Invalid referer URL
    }
  }
  
  // In development, be more permissive
  if (process.env.NODE_ENV === 'development') {
    return true
  }
  
  return false
}

// Public addon item type - excludes internal cost/margin data
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
 * Note: Does NOT expose addon cost or margin data
 * SECURITY: Only accessible from same origin
 */
export async function GET(request: Request) {
  // SECURITY: Only allow requests from same origin
  if (!isRequestFromAllowedOrigin(request)) {
    return NextResponse.json(
      { error: 'Forbidden' },
      { status: 403 }
    )
  }
  
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
          
          // Only include public-safe data
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
            // Intentionally NOT including: addonCost, addonMargin
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
    console.error('[API] Addons fetch error')
    return NextResponse.json(
      { error: 'Failed to fetch addon items' },
      { status: 500 }
    )
  }
}

