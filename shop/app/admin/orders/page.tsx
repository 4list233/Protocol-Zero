"use client"

import { useEffect, useState } from 'react'
import { useAuth } from '@/lib/auth-context'
import { useSearchParams } from 'next/navigation'
import Link from 'next/link'
import { StatusBadge } from '@/components/admin/status-badge'

export default function OrdersPage() {
  const { user, loading: authLoading } = useAuth()
  const searchParams = useSearchParams()
  const status = searchParams.get('status') || undefined
  const [orders, setOrders] = useState<any[]>([])
  const [ordersLoading, setOrdersLoading] = useState(true)

  useEffect(() => {
    if (user) {
      user.getIdToken().then((idToken: string) => {
        const qs = status ? `?status=${encodeURIComponent(status)}` : ''
        fetch(`/api/admin/orders${qs}`, {
          headers: {
            'Authorization': `Bearer ${idToken}`,
            'x-user-email': user.email || '',
            'x-user-id': user.uid,
          },
          cache: 'no-store',
        })
          .then(res => {
            if (!res.ok) throw new Error('Failed to fetch orders')
            return res.json()
          })
          .then(data => {
            setOrders(data.orders || [])
            setOrdersLoading(false)
          })
          .catch(err => {
            console.error('Error fetching orders:', err)
            setOrdersLoading(false)
          })
      }).catch(err => {
        console.error('Error getting ID token:', err)
        setOrdersLoading(false)
      })
    } else if (!authLoading) {
      setOrdersLoading(false)
    }
  }, [user, status, authLoading])

  if (authLoading || ordersLoading) {
    return (
      <div className="space-y-4">
        <h1 className="text-xl font-semibold">Orders</h1>
        <div className="text-neutral-400">Loading orders...</div>
      </div>
    )
  }

  return (
    <div className="space-y-4">
      <div className="flex items-center justify-between">
        <h1 className="text-xl font-semibold">Orders</h1>
        <div className="flex items-center gap-2 text-sm">
          <Link href="/admin/orders" className={`px-3 py-1 rounded border border-[#2C2C2C] ${!status ? 'bg-[#1E1E1E]' : ''}`}>All</Link>
          {['placed','paid','purchasing','in_production','shipped','ready_for_pickup','dropoff_scheduled','dropped_off','completed','cancelled'].map(s => (
            <Link key={s} href={`/admin/orders?status=${s}`} className={`px-3 py-1 rounded border border-[#2C2C2C] ${status===s ? 'bg-[#1E1E1E]' : ''}`}>{s.replaceAll('_',' ')}</Link>
          ))}
        </div>
      </div>

      <div className="overflow-x-auto">
        <table className="w-full text-sm border border-[#2C2C2C] rounded-xl overflow-hidden">
          <thead className="bg-[#121212] text-neutral-300">
            <tr>
              <th className="text-left p-3 border-b border-[#2C2C2C]">Order</th>
              <th className="text-left p-3 border-b border-[#2C2C2C]">Customer</th>
              <th className="text-left p-3 border-b border-[#2C2C2C]">Total</th>
              <th className="text-left p-3 border-b border-[#2C2C2C]">Status</th>
              <th className="text-left p-3 border-b border-[#2C2C2C]">Created</th>
              <th className="text-left p-3 border-b border-[#2C2C2C]"></th>
            </tr>
          </thead>
          <tbody>
            {orders?.map((o:any) => (
              <tr key={o.id} className="hover:bg-[#111] border-b border-[#2C2C2C]">
                <td className="p-3">
                  <div className="font-medium">{o.id}</div>
                </td>
                <td className="p-3">
                  <div>{o.customerName || o.userEmail || o.userId}</div>
                </td>
                <td className="p-3">${(o.totalCad?.toFixed?.(2) || o.totalCad)}</td>
                <td className="p-3"><StatusBadge status={o.status} /></td>
                <td className="p-3">{typeof o.createdAt === 'string' ? new Date(o.createdAt).toLocaleString() : (o.createdAt?.toDate?.() ? o.createdAt.toDate().toLocaleString() : '')}</td>
                <td className="p-3 text-right">
                  <Link href={`/admin/orders/${o.id}`} className="text-xs px-3 py-1 rounded border border-[#2C2C2C] hover:bg-[#1E1E1E]">Open</Link>
                </td>
              </tr>
            ))}
            {(!orders || orders.length === 0) && (
              <tr>
                <td colSpan={6} className="p-6 text-center text-neutral-400">No orders found</td>
              </tr>
            )}
          </tbody>
        </table>
      </div>
    </div>
  )
}
