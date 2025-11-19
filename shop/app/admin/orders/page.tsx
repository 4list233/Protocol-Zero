import Link from 'next/link'
import { StatusBadge } from '@/components/admin/status-badge'

async function fetchOrders(status?: string) {
  const qs = status ? `?status=${encodeURIComponent(status)}` : ''
  const res = await fetch(`${process.env.NEXT_PUBLIC_BASE_URL || ''}/api/admin/orders${qs}`, {
    cache: 'no-store',
  })
  if (!res.ok) {
    // Try relative in dev
    const rel = await fetch(`/api/admin/orders${qs}`, { cache: 'no-store' })
    if (!rel.ok) throw new Error('Failed to fetch orders')
    return rel.json()
  }
  return res.json()
}

export default async function OrdersPage({ searchParams }: { searchParams: { status?: string } }) {
  const status = searchParams?.status
  const data = await fetchOrders(status)
  const orders = data.orders as any[]

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
                <td className="p-3">${'{'}o.totalCad?.toFixed?.(2) || o.totalCad{'}'}</td>
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
