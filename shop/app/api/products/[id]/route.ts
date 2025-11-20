import { NextResponse } from 'next/server'
import { fetchProductById } from '@/lib/notion-client'
import { getCached, setCache } from '@/lib/notion-cache'

export const dynamic = 'force-dynamic'

export async function GET(
  _request: Request,
  { params }: { params: { id: string } }
) {
  try {
    const { id } = params
    const cacheKey = `product:${id}`

    const cached = getCached<any>(cacheKey)
    if (cached) {
      return NextResponse.json(cached, {
        headers: { 'Cache-Control': 'public, s-maxage=120, stale-while-revalidate=300' },
      })
    }

    const product = await fetchProductById(id)
    if (!product) {
      return NextResponse.json({ error: 'Product not found' }, { status: 404 })
    }

    setCache(cacheKey, product)

    return NextResponse.json(product, {
      headers: { 'Cache-Control': 'public, s-maxage=120, stale-while-revalidate=300' },
    })
  } catch (error) {
    console.error('Error fetching product:', error)
    return NextResponse.json({ error: 'Failed to fetch product' }, { status: 500 })
  }
}
