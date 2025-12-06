import { NextResponse } from 'next/server'
import { fetchProductById } from '@/lib/notion-client'
import { getCached, setCache } from '@/lib/notion-cache'
import { sanitizeProduct, type PublicProduct } from '@/lib/api-sanitizer'

export const dynamic = 'force-dynamic'

export async function GET(
  _request: Request,
  { params }: { params: Promise<{ id: string }> }
) {
  try {
    const { id } = await params
    const cacheKey = `product:${id}:public`

    // Check cache for already-sanitized product
    const cached = getCached<PublicProduct>(cacheKey)
    if (cached) {
      return NextResponse.json(cached, {
        headers: { 
          'Cache-Control': 'public, s-maxage=15, stale-while-revalidate=30',
          'X-Cache': 'HIT'
        },
      })
    }

    const product = await fetchProductById(id)
    if (!product) {
      return NextResponse.json({ error: 'Product not found' }, { status: 404 })
    }

    // Sanitize product before caching and returning
    // Removes: margin, price_cny, addonCost, addonMargin
    const publicProduct = sanitizeProduct(product)
    setCache(cacheKey, publicProduct)

    return NextResponse.json(publicProduct, {
      headers: { 
        'Cache-Control': 'public, s-maxage=15, stale-while-revalidate=30',
        'X-Cache': 'MISS'
      },
    })
  } catch (error) {
    console.error('[API] Product fetch error')
    return NextResponse.json({ error: 'Failed to fetch product' }, { status: 500 })
  }
}
