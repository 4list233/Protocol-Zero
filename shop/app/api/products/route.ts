import { NextResponse } from 'next/server'
import { fetchProducts, type ProductRuntime } from '@/lib/notion-client'
import { getCached, setCache } from '@/lib/notion-cache'
import { sanitizeProducts, type PublicProduct } from '@/lib/api-sanitizer'

// Removed force-dynamic so Vercel CDN respects the Cache-Control headers below

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
  const host = request.headers.get('host')
  
  // Always allow same-origin requests (when host matches request URL)
  // This handles Next.js internal API calls and direct browser requests
  if (!origin && host) {
    // Same-origin request - no origin header means it's from the same domain
    return true
  }
  
  // Check origin header (CORS requests)
  if (origin && ALLOWED_ORIGINS.includes(origin)) {
    return true
  }
  
  // Check referer header (for some browsers/scenarios)
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

export async function GET(request: Request) {
  // SECURITY: Only allow requests from same origin
  if (!isRequestFromAllowedOrigin(request)) {
    return NextResponse.json(
      { error: 'Forbidden' },
      { status: 403 }
    )
  }
  
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
