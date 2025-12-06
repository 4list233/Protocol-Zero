import { NextResponse } from 'next/server'
import { fetchProductById } from '@/lib/notion-client'
import { getCached, setCache } from '@/lib/notion-cache'
import { sanitizeProduct, type PublicProduct } from '@/lib/api-sanitizer'

export const dynamic = 'force-dynamic'

// Allowed origins for product API access
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

export async function GET(
  request: Request,
  { params }: { params: Promise<{ id: string }> }
) {
  // SECURITY: Only allow requests from same origin
  if (!isRequestFromAllowedOrigin(request)) {
    return NextResponse.json(
      { error: 'Forbidden' },
      { status: 403 }
    )
  }
  
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
