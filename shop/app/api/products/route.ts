import { NextResponse } from 'next/server'
import { fetchProducts, type ProductRuntime } from '@/lib/notion-client'
import { getCached, setCache } from '@/lib/notion-cache'
import { sanitizeProducts, type PublicProduct } from '@/lib/api-sanitizer'

export const dynamic = 'force-dynamic'

export async function GET() {
  try {
    // Check cache for already-sanitized products
    const cached = getCached<PublicProduct[]>('products:all:public')
    if (cached) {
      return NextResponse.json(cached, {
        headers: { 
          'Cache-Control': 'public, s-maxage=15, stale-while-revalidate=30',
          'X-Cache': 'HIT'
        },
      })
    }

    const products = await fetchProducts()
    
    // Sanitize products before caching and returning
    // Removes: margin, price_cny, addonCost, addonMargin
    const publicProducts = sanitizeProducts(products)
    setCache('products:all:public', publicProducts)

    return NextResponse.json(publicProducts, {
      headers: { 
        'Cache-Control': 'public, s-maxage=15, stale-while-revalidate=30',
        'X-Cache': 'MISS'
      },
    })
  } catch (error) {
    console.error('[API] Products fetch error')
    return NextResponse.json({ error: 'Failed to fetch products' }, { status: 500 })
  }
}
