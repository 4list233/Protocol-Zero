import type React from "react"
import type { Metadata } from "next"
import { GeistSans } from "geist/font/sans"
import { GeistMono } from "geist/font/mono"
import { Analytics } from "@vercel/analytics/next"
import { ToastProvider } from "@/components/toast-provider"
import { AuthProvider } from "@/lib/auth-context"
import "./globals.css"
import { Suspense } from "react"

export const metadata: Metadata = {
  title: "Protocol Zero Airsoft — Social Hub & Gear Shop",
  description: "The social hub for airsoft enthusiasts. Share clips, check game schedules, and shop premium gear.",
  generator: "v0.app",
  openGraph: {
    title: "Protocol Zero Airsoft — Social Hub & Gear Shop",
    description: "The social hub for airsoft enthusiasts. Share clips, check game schedules, and shop premium gear.",
    type: "website",
    images: [
      {
        url: "/og-image.jpg",
        width: 1200,
        height: 630,
        alt: "Protocol Zero Airsoft",
      },
    ],
  },
}

export default function RootLayout({
  children,
}: Readonly<{
  children: React.ReactNode
}>) {
  return (
    <html lang="en" className="dark">
      <body className={`font-sans ${GeistSans.variable} ${GeistMono.variable} antialiased`}>
        <AuthProvider>
          <ToastProvider>
            <Suspense fallback={null}>{children}</Suspense>
          </ToastProvider>
        </AuthProvider>
        <Analytics />
      </body>
    </html>
  )
}
