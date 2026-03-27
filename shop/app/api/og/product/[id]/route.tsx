import { ImageResponse } from 'next/og'
import { fetchProductById } from '@/lib/catalog'

export const runtime = 'nodejs'

export async function GET(
  _request: Request,
  { params }: { params: Promise<{ id: string }> }
) {
  try {
    const { id } = await params
    const product = await fetchProductById(id)

    if (!product) {
      return new Response('Product not found', { status: 404 })
    }

    // Get cheapest variant price
    const cheapestPrice = product.variants?.reduce((min, v) => {
      const p = v.price_cad || 0
      return p < min ? p : min
    }, Number.POSITIVE_INFINITY) || 0

    const priceStr = cheapestPrice === Infinity ? '$0.00' : `$${cheapestPrice.toFixed(2)}`

    // Fetch product image as base64 for embedding
    let imageData: string | null = null
    const imageUrl = product.primaryImage || product.images?.[0]
    if (imageUrl && imageUrl.startsWith('http')) {
      try {
        const imgRes = await fetch(imageUrl)
        if (imgRes.ok) {
          const buffer = await imgRes.arrayBuffer()
          const base64 = Buffer.from(buffer).toString('base64')
          const contentType = imgRes.headers.get('content-type') || 'image/jpeg'
          imageData = `data:${contentType};base64,${base64}`
        }
      } catch {
        // Fallback: no image
      }
    }

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
          {/* Background subtle grid pattern */}
          <div
            style={{
              position: 'absolute',
              inset: 0,
              backgroundImage: 'radial-gradient(circle at 1px 1px, #1E1E1E 1px, transparent 0)',
              backgroundSize: '40px 40px',
              display: 'flex',
            }}
          />

          {/* Product Image - centered */}
          {imageData ? (
            <img
              src={imageData}
              width={340}
              height={340}
              style={{
                objectFit: 'contain',
                borderRadius: '16px',
                marginBottom: '20px',
              }}
            />
          ) : (
            <div
              style={{
                width: '340',
                height: '340',
                backgroundColor: '#1E1E1E',
                borderRadius: '16px',
                display: 'flex',
                alignItems: 'center',
                justifyContent: 'center',
                color: '#A1A1A1',
                fontSize: '48',
                marginBottom: '20px',
              }}
            >
              PZ
            </div>
          )}

          {/* Bottom bar with title + price */}
          <div
            style={{
              position: 'absolute',
              bottom: '0',
              left: '0',
              right: '0',
              display: 'flex',
              alignItems: 'center',
              justifyContent: 'space-between',
              padding: '24px 32px',
              backgroundColor: 'rgba(30, 30, 30, 0.9)',
              borderTop: '1px solid #2C2C2C',
            }}
          >
            <div
              style={{
                display: 'flex',
                flexDirection: 'column',
                flex: '1',
                marginRight: '24px',
              }}
            >
              <div
                style={{
                  color: '#F5F5F5',
                  fontSize: '24',
                  fontWeight: '700',
                  lineHeight: '1.3',
                  display: 'flex',
                  maxWidth: '700px',
                }}
              >
                {product.title}
              </div>
              <div
                style={{
                  color: '#A1A1A1',
                  fontSize: '14',
                  marginTop: '4px',
                  display: 'flex',
                }}
              >
                Protocol Zero Airsoft
              </div>
            </div>
            <div
              style={{
                display: 'flex',
                flexDirection: 'column',
                alignItems: 'flex-end',
              }}
            >
              <div
                style={{
                  color: '#3D9A6C',
                  fontSize: '32',
                  fontWeight: '700',
                  display: 'flex',
                }}
              >
                {priceStr}
              </div>
              <div
                style={{
                  color: '#A1A1A1',
                  fontSize: '14',
                  textTransform: 'uppercase',
                  display: 'flex',
                }}
              >
                CAD
              </div>
            </div>
          </div>
        </div>
      ),
      {
        width: 1200,
        height: 630,
        headers: {
          'Cache-Control': 'public, s-maxage=86400, stale-while-revalidate=604800',
        },
      }
    )
  } catch (error) {
    console.error('[OG] Product image generation error:', error)
    return new Response('Failed to generate image', { status: 500 })
  }
}
