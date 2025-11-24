"use client"

import { ReactNode, useEffect } from 'react'
import { useAuth } from '@/lib/auth-context'
import { ADMIN_EMAILS } from '@/lib/constants'
import Link from 'next/link'
import { useRouter } from 'next/navigation'

export default function AdminProductsLayout({ children }: { children: ReactNode }) {
  const { user, loading } = useAuth()
  const router = useRouter()

  useEffect(() => {
    if (!loading) {
      if (!user || !user.email || !ADMIN_EMAILS.includes(user.email)) {
        router.push('/auth/signin?callbackUrl=/admin/products')
      }
    }
  }, [user, loading, router])

  if (loading) {
    return (
      <div className="min-h-screen bg-[#0D0D0D] text-white flex items-center justify-center">
        <div className="text-center">
          <div className="animate-spin h-12 w-12 border-4 border-white border-t-transparent rounded-full mx-auto mb-4"></div>
          <p className="text-neutral-400">Loading...</p>
        </div>
      </div>
    )
  }

  if (!user || !user.email || !ADMIN_EMAILS.includes(user.email)) {
    return null
  }

  return (
    <div className="min-h-screen bg-[#0D0D0D] text-white">
      <header className="sticky top-0 z-40 border-b border-[#2C2C2C] bg-[#1E1E1E]/95 backdrop-blur">
        <div className="mx-auto max-w-7xl px-4 py-3 flex items-center justify-between">
          <div className="flex items-center gap-6">
            <Link href="/" className="text-sm text-neutral-300 hover:text-white">← Back to shop</Link>
            <nav className="flex items-center gap-4 text-sm">
              <Link href="/admin/orders" className="hover:text-white text-neutral-300">Orders</Link>
              <Link href="/admin/products" className="hover:text-white text-neutral-300">Products</Link>
            </nav>
          </div>
          <div className="text-xs text-neutral-400">Admin: {user.email}</div>
        </div>
      </header>
      <main className="mx-auto max-w-7xl px-4 py-6">
        {children}
      </main>
    </div>
  )
}
