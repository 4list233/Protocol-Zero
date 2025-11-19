"use client"

import useSWR from 'swr'
import { useState } from 'react'
import { StatusBadge } from '@/components/admin/status-badge'
import Link from 'next/link'

const fetcher = (url: string) => fetch(url).then(r => r.json())

export default function AdminOrderDetail({ params }: { params: { id: string } }) {
  const { data, mutate } = useSWR(`/api/admin/orders/${params.id}`, fetcher)
  const order = data?.order
  const [loading, setLoading] = useState<string | null>(null)
  const [note, setNote] = useState('')

  async function act(action: string, payload: any = {}) {
    setLoading(action)
    try {
      const res = await fetch(`/api/admin/orders/${params.id}`, {
        method: 'PATCH',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ action, payload }),
      })
      if (!res.ok) throw new Error('Action failed')
      await mutate()
      setNote('')
    } catch (e) {
      console.error(e)
      alert('Failed')
    } finally {
      setLoading(null)
    }
  }

  if (!order) return <div>Loading...</div>

  return (
    <div className="space-y-6">
      <div className="flex items-center justify-between">
        <div>
          <h1 className="text-xl font-semibold">Order {order.id}</h1>
          <div className="text-sm text-neutral-400">Customer: {order.customerName || order.userEmail || order.userId}</div>
        </div>
        <div className="flex items-center gap-3">
          <StatusBadge status={order.status} />
          <Link href="/admin/orders" className="text-sm text-neutral-300 hover:text-white">Back to orders</Link>
        </div>
      </div>

      <div className="grid grid-cols-1 md:grid-cols-3 gap-6">
        <section className="md:col-span-2 space-y-4">
          <div className="border border-[#2C2C2C] rounded-xl overflow-hidden">
            <div className="p-4 border-b border-[#2C2C2C] bg-[#121212] font-medium">Items</div>
            <ul>
              {order.items?.map((it:any, idx:number) => (
                <li key={idx} className="p-4 border-b border-[#2C2C2C] flex items-center gap-3">
                  {it.image && <img src={it.image} alt="" className="w-12 h-12 object-cover rounded" />}
                  <div className="flex-1">
                    <div className="font-medium">{it.title}</div>
                    <div className="text-xs text-neutral-400">{it.option}</div>
                  </div>
                  <div className="text-sm">x{it.quantity}</div>
                  <div className="w-24 text-right text-sm">${'{'}(it.unitPriceCad * it.quantity).toFixed(2){'}'}</div>
                </li>
              ))}
            </ul>
            <div className="p-4 flex justify-end gap-6 text-sm">
              <div>Subtotal: ${'{'}order.subtotalCad?.toFixed?.(2) || order.subtotalCad{'}'}</div>
              <div>Shipping: ${'{'}order.shippingCad?.toFixed?.(2) || order.shippingCad{'}'}</div>
              <div className="font-semibold">Total: ${'{'}order.totalCad?.toFixed?.(2) || order.totalCad{'}'}</div>
            </div>
          </div>

          <div className="border border-[#2C2C2C] rounded-xl overflow-hidden">
            <div className="p-4 border-b border-[#2C2C2C] bg-[#121212] font-medium">Status History</div>
            <ul className="divide-y divide-[#2C2C2C]">
              {order.statusHistory?.map((h:any, idx:number) => (
                <li key={idx} className="p-4 flex items-center justify-between">
                  <div className="flex items-center gap-3">
                    <StatusBadge status={h.status} />
                    <div className="text-sm text-neutral-300">{h.note}</div>
                  </div>
                  <div className="text-xs text-neutral-400">{new Date(h.at?.seconds ? h.at.seconds * 1000 : h.at).toLocaleString()}</div>
                </li>
              ))}
            </ul>
          </div>
        </section>

        <section className="space-y-4">
          <div className="border border-[#2C2C2C] rounded-xl overflow-hidden">
            <div className="p-3 border-b border-[#2C2C2C] bg-[#121212] font-medium">Quick Actions</div>
            <div className="p-3 space-y-3">
              <input placeholder="Optional note" value={note} onChange={e=>setNote(e.target.value)} className="w-full bg-transparent border border-[#2C2C2C] rounded px-3 py-2 text-sm" />
              {order.status === 'placed' && (
                <button disabled={loading==='markPaid'} onClick={()=>act('markPaid',{ note })} className="w-full text-sm bg-blue-600 hover:bg-blue-700 py-2 rounded">Mark Paid (e‑transfer)</button>
              )}
              {(order.status === 'paid' || order.status === 'placed') && (
                <button disabled={loading==='setPurchasing'} onClick={()=>act('setPurchasing',{ note })} className="w-full text-sm bg-amber-600 hover:bg-amber-700 py-2 rounded">Start Purchasing</button>
              )}
              {(order.status === 'paid' || order.status === 'purchasing' || order.status === 'in_production') && (
                <button disabled={loading==='setInProduction'} onClick={()=>act('setInProduction',{ note })} className="w-full text-sm bg-amber-700 hover:bg-amber-800 py-2 rounded">Set In Production</button>
              )}
              {(order.status === 'purchasing' || order.status === 'in_production') && (
                <button disabled={loading==='markShipped'} onClick={()=>act('markShipped',{ shipping: {}, note })} className="w-full text-sm bg-indigo-600 hover:bg-indigo-700 py-2 rounded">Mark Shipped</button>
              )}
              {(order.status === 'shipped' || order.status === 'in_production') && (
                <button disabled={loading==='schedulePickup'} onClick={()=>act('schedulePickup',{ pickup: { locationId: 'ultimate-airsoft', scheduledAt: new Date().toISOString(), confirmedByCustomer: false }, note })} className="w-full text-sm bg-green-700 hover:bg-green-800 py-2 rounded">Schedule Pickup</button>
              )}
              {(order.status === 'dropoff_scheduled' || order.status === 'ready_for_pickup') && (
                <button disabled={loading==='recordDropOff'} onClick={()=>act('recordDropOff',{ dropoff: { locationId: 'reception', scheduledAt: new Date().toISOString() }, note })} className="w-full text-sm bg-purple-700 hover:bg-purple-800 py-2 rounded">Record Drop-Off</button>
              )}
              {(order.status !== 'completed' && order.status !== 'cancelled') && (
                <button disabled={loading==='complete'} onClick={()=>act('complete',{ note })} className="w-full text-sm bg-emerald-700 hover:bg-emerald-800 py-2 rounded">Complete</button>
              )}
              {(order.status !== 'completed' && order.status !== 'cancelled') && (
                <button disabled={loading==='cancel'} onClick={()=>act('cancel',{ note })} className="w-full text-sm bg-red-700 hover:bg-red-800 py-2 rounded">Cancel</button>
              )}
            </div>
          </div>

          <div className="border border-[#2C2C2C] rounded-xl overflow-hidden">
            <div className="p-3 border-b border-[#2C2C2C] bg-[#121212] font-medium">Shipping & Pickup</div>
            <div className="p-3 space-y-3 text-sm">
              <div>Carrier: {order.shipping?.carrier || '-'}</div>
              <div>Tracking: {order.shipping?.tracking || '-'}</div>
              <div>Pickup: {order.pickup?.locationId || '-'} at {order.pickup?.scheduledAt ? new Date(order.pickup.scheduledAt?.seconds ? order.pickup.scheduledAt.seconds*1000 : order.pickup.scheduledAt).toLocaleString() : '-'}</div>
              <div>Drop-off: {order.dropoff?.locationId || '-'} at {order.dropoff?.scheduledAt ? new Date(order.dropoff.scheduledAt?.seconds ? order.dropoff.scheduledAt.seconds*1000 : order.dropoff.scheduledAt).toLocaleString() : '-'}</div>
              {order.dropoff?.photoUrl && <img src={order.dropoff.photoUrl} alt="Proof" className="w-full max-w-xs rounded" />}
            </div>
          </div>
        </section>
      </div>
    </div>
  )
}
