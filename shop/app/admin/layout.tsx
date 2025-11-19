import { ReactNode } from 'react'
import { auth } from '@/lib/auth'
import { ADMIN_EMAILS } from '@/lib/constants'
import Link from 'next/link'
import { redirect } from 'next/navigation'

export default async function AdminLayout({ children }: { children: ReactNode }) {
  const session = await auth()
  if (!session?.user?.email || !ADMIN_EMAILS.includes(session.user.email)) {
    redirect('/auth/signin')
  }

  return (
    <div className="min-h-screen bg-[#0D0D0D] text-white">
      <header className="sticky top-0 z-40 border-b border-[#2C2C2C] bg-[#1E1E1E]/95 backdrop-blur">
        <div className="mx-auto max-w-7xl px-4 py-3 flex items-center justify-between">
          <div className="flex items-center gap-6">
            <Link href="/" className="text-sm text-neutral-300 hover:text-white">← Back to shop</Link>
            <nav className="flex items-center gap-4 text-sm">
              <Link href="/admin/orders" className="hover:text-white text-neutral-300">Orders</Link>
            </nav>
          </div>
          <div className="text-xs text-neutral-400">Admin: {session.user.email}</div>
        </div>
      </header>
      <main className="mx-auto max-w-7xl px-4 py-6">
        {children}
      </main>
    </div>
  )
}
