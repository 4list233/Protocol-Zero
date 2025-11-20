import { NextResponse } from 'next/server'
import { fetchProducts } from '@/lib/notion-client'
import { getCached, setCache } from '@/lib/notion-cache'

export const dynamic = 'force-dynamic'

export async function GET() {
  try {
    const cached = getCached<any[]>('products:all')
    if (cached) {
      return NextResponse.json(cached, {
        headers: { 'Cache-Control': 'public, s-maxage=120, stale-while-revalidate=300' },
      })
    }

    const products = await fetchProducts()
    setCache('products:all', products)

    return NextResponse.json(products, {
      headers: { 'Cache-Control': 'public, s-maxage=120, stale-while-revalidate=300' },
    })
  } catch (error) {
    console.error('Error fetching products:', error)
    return NextResponse.json({ error: 'Failed to fetch products' }, { status: 500 })
  }
}
