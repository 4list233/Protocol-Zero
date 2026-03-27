import type { Metadata } from 'next'
import { fetchProductById } from '@/lib/catalog'
import { ProductDetailPage } from './product-detail'

type Props = {
  params: Promise<{ id: string }>
}

export async function generateMetadata({ params }: Props): Promise<Metadata> {
  const { id } = await params

  try {
    const product = await fetchProductById(id)
    if (!product) {
      return { title: 'Product Not Found — Protocol Zero Airsoft' }
    }

    const cheapestPrice = product.variants?.reduce((min, v) => {
      const p = v.price_cad || 0
      return p < min ? p : min
    }, Number.POSITIVE_INFINITY) || 0

    const priceStr = cheapestPrice === Infinity ? '' : `$${cheapestPrice.toFixed(2)} CAD`
    const description = product.description
      ? product.description.slice(0, 155)
      : `${product.category ? product.category + ' — ' : ''}${priceStr ? priceStr + ' — ' : ''}Shop at Protocol Zero Airsoft`

    const baseUrl = process.env.NEXT_PUBLIC_BASE_URL || 'https://pzairsoft.ca'

    return {
      title: `${product.title} — Protocol Zero Airsoft`,
      description,
      openGraph: {
        title: product.title,
        description,
        type: 'website',
        url: `${baseUrl}/shop/${id}`,
        images: [
          {
            url: `${baseUrl}/api/og/product/${id}`,
            width: 1200,
            height: 630,
            alt: product.title,
          },
        ],
      },
      twitter: {
        card: 'summary_large_image',
        title: product.title,
        description,
        images: [`${baseUrl}/api/og/product/${id}`],
      },
    }
  } catch {
    return { title: 'Product — Protocol Zero Airsoft' }
  }
}

export default function Page({ params }: Props) {
  return <ProductDetailPage params={params} />
}
