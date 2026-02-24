"use client"

import { ShoppingBag } from "lucide-react"

export default function OrdersPage() {
  return (
    <div className="space-y-6">
      <div>
        <h1 className="text-2xl font-bold text-white">Orders</h1>
        <p className="text-zinc-400 mt-1">Manage customer orders</p>
      </div>

      <div className="bg-zinc-900 rounded-lg border border-zinc-800 p-12 text-center">
        <ShoppingBag className="w-12 h-12 mx-auto text-zinc-600 mb-4" />
        <h2 className="text-lg font-semibold text-white mb-2">Order Management Coming Soon</h2>
        <p className="text-zinc-400 text-sm max-w-sm mx-auto">
          Order tracking and fulfillment tools will be available here in a future update.
        </p>
      </div>
    </div>
  )
}
