import { NextResponse } from 'next/server'
import { fetchProducts, type ProductRuntime } from '@/lib/notion-client'
import { getCached, setCache } from '@/lib/notion-cache'

export const dynamic = 'force-dynamic'

export async function GET() {
  try {
    const cached = getCached<ProductRuntime[]>('products:all')
    if (cached) {
      return NextResponse.json(cached, {
        headers: { 
          'Cache-Control': 'public, s-maxage=15, stale-while-revalidate=30',
          'X-Cache': 'HIT'
        },
      })
    }

    const products = await fetchProducts()
    setCache('products:all', products)

    return NextResponse.json(products, {
      headers: { 
        'Cache-Control': 'public, s-maxage=15, stale-while-revalidate=30',
        'X-Cache': 'MISS'
      },
    })
  } catch (error) {
    console.error('Error fetching products:', error)
    return NextResponse.json({ error: 'Failed to fetch products' }, { status: 500 })
  }
}
