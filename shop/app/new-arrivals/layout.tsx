import type { Metadata } from 'next'

const baseUrl = process.env.NEXT_PUBLIC_BASE_URL || 'https://pzairsoft.ca'

export const metadata: Metadata = {
  title: 'New Arrivals — Protocol Zero Airsoft',
  description: 'Check out the latest gear drops at Protocol Zero Airsoft.',
  openGraph: {
    title: 'New Arrivals — Protocol Zero Airsoft',
    description: 'Check out the latest gear drops at Protocol Zero Airsoft.',
    type: 'website',
    url: `${baseUrl}/new-arrivals`,
    images: [
      {
        url: `${baseUrl}/api/og/new-arrivals`,
        width: 1200,
        height: 630,
        alt: 'New Arrivals — Protocol Zero Airsoft',
      },
    ],
  },
  twitter: {
    card: 'summary_large_image',
    title: 'New Arrivals — Protocol Zero Airsoft',
    description: 'Check out the latest gear drops at Protocol Zero Airsoft.',
    images: [`${baseUrl}/api/og/new-arrivals`],
  },
}

export default function NewArrivalsLayout({
  children,
}: {
  children: React.ReactNode
}) {
  return children
}
