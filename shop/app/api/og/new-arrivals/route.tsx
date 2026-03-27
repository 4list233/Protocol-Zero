import { ImageResponse } from 'next/og'
import { fetchProducts } from '@/lib/catalog'
import { getStorefrontSettings } from '@/lib/storefront-settings'
import { isProductNew } from '@/lib/categories'

export const runtime = 'nodejs'

export async function GET() {
  try {
    const settings = getStorefrontSettings()
    const products = await fetchProducts()

    // Get newest products
    const newProducts = products
      .filter(p => isProductNew(p.createdAt, settings.newArrivalsWindowDays))
      .sort((a, b) => {
        const da = a.createdAt ? new Date(a.createdAt).getTime() : 0
        const db = b.createdAt ? new Date(b.createdAt).getTime() : 0
        return db - da
      })
      .slice(0, 4)

    // Fetch up to 4 product images
    const imagePromises = newProducts.map(async (p) => {
      const url = p.primaryImage || p.images?.[0]
      if (!url || !url.startsWith('http')) return null
      try {
        const res = await fetch(url)
        if (!res.ok) return null
        const buffer = await res.arrayBuffer()
        const base64 = Buffer.from(buffer).toString('base64')
        const contentType = res.headers.get('content-type') || 'image/jpeg'
        return `data:${contentType};base64,${base64}`
      } catch {
        return null
      }
    })

    const images = (await Promise.all(imagePromises)).filter(Boolean) as string[]

    return new ImageResponse(
      (
        <div
          style={{
            width: '1200',
            height: '630',
            display: 'flex',
            flexDirection: 'column',
            alignItems: 'center',
            justifyContent: 'center',
            backgroundColor: '#0D0D0D',
            position: 'relative',
          }}
        >
          {/* Background */}
          <div
            style={{
              position: 'absolute',
              inset: 0,
              background: 'linear-gradient(135deg, rgba(5, 150, 105, 0.15) 0%, transparent 60%)',
              display: 'flex',
            }}
          />

          {/* Title */}
          <div
            style={{
              display: 'flex',
              flexDirection: 'column',
              alignItems: 'center',
              marginBottom: '32px',
            }}
          >
            <div
              style={{
                color: '#3D9A6C',
                fontSize: '18',
                fontWeight: '600',
                textTransform: 'uppercase',
                letterSpacing: '0.15em',
                marginBottom: '8px',
                display: 'flex',
              }}
            >
              Protocol Zero Airsoft
            </div>
            <div
              style={{
                color: '#F5F5F5',
                fontSize: '48',
                fontWeight: '700',
                display: 'flex',
              }}
            >
              New Arrivals
            </div>
            <div
              style={{
                color: '#A1A1A1',
                fontSize: '18',
                marginTop: '8px',
                display: 'flex',
              }}
            >
              {newProducts.length} new {newProducts.length === 1 ? 'product' : 'products'} just dropped
            </div>
          </div>

          {/* Product image grid */}
          {images.length > 0 && (
            <div
              style={{
                display: 'flex',
                gap: '16',
                justifyContent: 'center',
              }}
            >
              {images.map((src, i) => (
                <img
                  key={i}
                  src={src}
                  width={160}
                  height={160}
                  style={{
                    objectFit: 'cover',
                    borderRadius: '12px',
                    border: '2px solid #2C2C2C',
                  }}
                />
              ))}
            </div>
          )}
        </div>
      ),
      {
        width: 1200,
        height: 630,
        headers: {
          'Cache-Control': 'public, s-maxage=3600, stale-while-revalidate=86400',
        },
      }
    )
  } catch (error) {
    console.error('[OG] New arrivals image generation error:', error)
    return new Response('Failed to generate image', { status: 500 })
  }
}
