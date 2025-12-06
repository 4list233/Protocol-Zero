import { NextResponse } from 'next/server'
import type { NextRequest } from 'next/server'

// =============================================================================
// RATE LIMITING (In-memory - resets on cold start, sufficient for Vercel)
// =============================================================================

type RateLimitEntry = {
  count: number
  resetTime: number
}

// Rate limit store (per-IP)
const rateLimitStore = new Map<string, RateLimitEntry>()

// Rate limit configuration by route pattern
const RATE_LIMITS: Record<string, { requests: number; windowMs: number }> = {
  '/api/checkout': { requests: 5, windowMs: 60 * 1000 }, // 5 requests per minute
  '/api/products': { requests: 60, windowMs: 60 * 1000 }, // 60 requests per minute
  '/api/addons': { requests: 60, windowMs: 60 * 1000 }, // 60 requests per minute
  '/api/revalidate': { requests: 10, windowMs: 60 * 1000 }, // 10 requests per minute
  default: { requests: 100, windowMs: 60 * 1000 }, // 100 requests per minute
}

function getRateLimitConfig(pathname: string) {
  for (const [pattern, config] of Object.entries(RATE_LIMITS)) {
    if (pattern !== 'default' && pathname.startsWith(pattern)) {
      return config
    }
  }
  return RATE_LIMITS.default
}

function checkRateLimit(ip: string, pathname: string): { allowed: boolean; remaining: number } {
  const config = getRateLimitConfig(pathname)
  const key = `${ip}:${pathname.split('/').slice(0, 3).join('/')}`
  const now = Date.now()
  
  const entry = rateLimitStore.get(key)
  
  if (!entry || now > entry.resetTime) {
    rateLimitStore.set(key, { count: 1, resetTime: now + config.windowMs })
    return { allowed: true, remaining: config.requests - 1 }
  }
  
  if (entry.count >= config.requests) {
    return { allowed: false, remaining: 0 }
  }
  
  entry.count++
  return { allowed: true, remaining: config.requests - entry.count }
}

// Clean up old entries periodically (every 5 minutes)
setInterval(() => {
  const now = Date.now()
  for (const [key, entry] of rateLimitStore.entries()) {
    if (now > entry.resetTime) {
      rateLimitStore.delete(key)
    }
  }
}, 5 * 60 * 1000)

// =============================================================================
// CORS CONFIGURATION
// =============================================================================

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

function getCorsHeaders(origin: string | null): Record<string, string> {
  const headers: Record<string, string> = {
    'Access-Control-Allow-Methods': 'GET, POST, OPTIONS',
    'Access-Control-Allow-Headers': 'Content-Type, Authorization',
    'Access-Control-Max-Age': '86400',
  }
  
  // Check if origin is allowed
  if (origin && ALLOWED_ORIGINS.includes(origin)) {
    headers['Access-Control-Allow-Origin'] = origin
  } else if (process.env.NODE_ENV === 'development') {
    // In development, be more permissive
    headers['Access-Control-Allow-Origin'] = origin || '*'
  }
  // In production with unknown origin, don't set Access-Control-Allow-Origin
  // (browser will block the request)
  
  return headers
}

// =============================================================================
// SECURITY HEADERS (Applied to ALL routes to prevent clickjacking)
// =============================================================================

function getSecurityHeaders(): Record<string, string> {
  return {
    // Prevent clickjacking - block all iframe embedding
    'X-Frame-Options': 'DENY',
    // Modern alternative to X-Frame-Options (more flexible, takes precedence)
    'Content-Security-Policy': "frame-ancestors 'none'",
    // Prevent MIME type sniffing
    'X-Content-Type-Options': 'nosniff',
    // XSS protection (legacy but still useful)
    'X-XSS-Protection': '1; mode=block',
    // Control referrer information
    'Referrer-Policy': 'strict-origin-when-cross-origin',
    // Permissions policy (prevent access to sensitive APIs)
    'Permissions-Policy': 'camera=(), microphone=(), geolocation=(), interest-cohort=()',
  }
}

// =============================================================================
// MIDDLEWARE
// =============================================================================

export function middleware(request: NextRequest) {
  const { pathname } = request.nextUrl
  const origin = request.headers.get('origin')
  const isApiRoute = pathname.startsWith('/api')
  
  // Get security headers (applied to ALL routes)
  const securityHeaders = getSecurityHeaders()
  
  // For non-API routes, just add security headers and return
  if (!isApiRoute) {
    const response = NextResponse.next()
    for (const [key, value] of Object.entries(securityHeaders)) {
      response.headers.set(key, value)
    }
    return response
  }
  
  // Handle CORS preflight requests
  if (request.method === 'OPTIONS') {
    return new NextResponse(null, {
      status: 204,
      headers: {
        ...getCorsHeaders(origin),
        ...securityHeaders,
      },
    })
  }
  
  // Get client IP (Vercel provides this)
  const ip = request.headers.get('x-forwarded-for')?.split(',')[0]?.trim() 
    || request.headers.get('x-real-ip') 
    || 'unknown'
  
  // Check rate limit
  const { allowed, remaining } = checkRateLimit(ip, pathname)
  
  if (!allowed) {
    return new NextResponse(
      JSON.stringify({ 
        error: 'Too many requests', 
        message: 'Please slow down and try again later' 
      }),
      {
        status: 429,
        headers: {
          'Content-Type': 'application/json',
          'Retry-After': '60',
          ...getCorsHeaders(origin),
          ...securityHeaders,
        },
      }
    )
  }
  
  // Continue with the request, adding headers to response
  const response = NextResponse.next()
  
  // Add CORS headers
  const corsHeaders = getCorsHeaders(origin)
  for (const [key, value] of Object.entries(corsHeaders)) {
    response.headers.set(key, value)
  }
  
  // Add security headers (already includes clickjacking protection)
  for (const [key, value] of Object.entries(securityHeaders)) {
    response.headers.set(key, value)
  }
  
  // Add rate limit headers
  response.headers.set('X-RateLimit-Remaining', remaining.toString())
  
  return response
}

// Configure which routes the middleware applies to
// Apply to ALL routes to ensure security headers are set everywhere
export const config = {
  matcher: [
    /*
     * Match all request paths except for the ones starting with:
     * - _next/static (static files)
     * - _next/image (image optimization files)
     * - favicon.ico (favicon file)
     * - public folder files (images, etc.)
     */
    '/((?!_next/static|_next/image|favicon.ico|.*\\.(?:svg|png|jpg|jpeg|gif|webp|ico)).*)',
  ],
}
