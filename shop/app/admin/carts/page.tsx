"use client"

import { useEffect, useState, Fragment } from "react"
import { useAdminFetch } from "@/hooks/use-admin-fetch"
import { ShoppingCart, Sparkles, ChevronDown, ChevronUp } from "lucide-react"
import Image from "next/image"

type AdminCartItem = {
  productId: string
  productTitle: string
  productImage: string
  category: string | null
  variantId: string
  variantTitle: string
  sku: string | null
  selectedOption: string | null
  regularPrice: number
  addonPrice: number | null
  isAddonEligible: boolean
  quantity: number
  itemType: string
}

type AdminCart = {
  id: string
  anonymousId: string | null
  email: string | null
  itemCount: number
  totalCad: number
  status: string
  lastActivityAt: string | null
  createdAt: string
  items: AdminCartItem[]
}

export default function AdminCartsPage() {
  const [carts, setCarts] = useState<AdminCart[]>([])
  const [loading, setLoading] = useState(true)
  const [statusFilter, setStatusFilter] = useState<string>("all")
  const [expandedId, setExpandedId] = useState<string | null>(null)
  const adminFetch = useAdminFetch()

  useEffect(() => {
    setLoading(true)
    const params = statusFilter !== "all" ? `?status=${statusFilter}` : ""
    adminFetch(`/api/admin/carts${params}`)
      .then(r => r?.ok ? r.json() : null)
      .then(data => {
        if (data?.carts) setCarts(data.carts)
      })
      .catch(() => {})
      .finally(() => setLoading(false))
  }, [adminFetch, statusFilter])

  const statusColors: Record<string, string> = {
    Active: "bg-green-900/40 text-green-400 border border-green-800",
    Abandoned: "bg-yellow-900/40 text-yellow-400 border border-yellow-800",
    Converted: "bg-blue-900/40 text-blue-400 border border-blue-800",
    Expired: "bg-zinc-800 text-zinc-500 border border-zinc-700",
  }

  const stats = {
    total: carts.length,
    active: carts.filter(c => c.status === "Active").length,
    abandoned: carts.filter(c => c.status === "Abandoned").length,
    converted: carts.filter(c => c.status === "Converted").length,
  }

  return (
    <div className="space-y-6">
      <div className="flex items-center gap-3">
        <ShoppingCart className="w-6 h-6 text-orange-500" />
        <h1 className="text-2xl font-bold text-white">Carts</h1>
      </div>

      {/* Stats row */}
      <div className="grid grid-cols-2 md:grid-cols-4 gap-3">
        <div className="bg-zinc-900 border border-zinc-800 rounded-lg p-3">
          <div className="text-xs text-zinc-500 uppercase">Total</div>
          <div className="text-xl font-bold text-white">{stats.total}</div>
        </div>
        <div className="bg-zinc-900 border border-zinc-800 rounded-lg p-3">
          <div className="text-xs text-green-500 uppercase">Active</div>
          <div className="text-xl font-bold text-green-400">{stats.active}</div>
        </div>
        <div className="bg-zinc-900 border border-zinc-800 rounded-lg p-3">
          <div className="text-xs text-yellow-500 uppercase">Abandoned</div>
          <div className="text-xl font-bold text-yellow-400">{stats.abandoned}</div>
        </div>
        <div className="bg-zinc-900 border border-zinc-800 rounded-lg p-3">
          <div className="text-xs text-blue-500 uppercase">Converted</div>
          <div className="text-xl font-bold text-blue-400">{stats.converted}</div>
        </div>
      </div>

      {/* Filter buttons */}
      <div className="flex gap-2 flex-wrap">
        {["all", "Active", "Abandoned", "Converted", "Expired"].map(s => (
          <button
            key={s}
            onClick={() => setStatusFilter(s)}
            className={`px-3 py-1.5 rounded-lg text-sm transition-colors ${
              statusFilter === s
                ? "bg-orange-600 text-white"
                : "bg-zinc-800 text-zinc-400 hover:bg-zinc-700 hover:text-white"
            }`}
          >
            {s === "all" ? "All" : s}
          </button>
        ))}
      </div>

      {/* Table */}
      {loading ? (
        <div className="flex items-center justify-center py-12">
          <div className="animate-spin rounded-full h-8 w-8 border-t-2 border-b-2 border-orange-500" />
        </div>
      ) : carts.length === 0 ? (
        <div className="text-center py-12 bg-zinc-900 rounded-lg border border-zinc-800 text-zinc-500">
          <ShoppingCart className="w-10 h-10 mx-auto mb-2 opacity-50" />
          <p>No carts found</p>
        </div>
      ) : (
        <div className="bg-zinc-900 border border-zinc-800 rounded-lg overflow-hidden">
          <table className="w-full">
            <thead>
              <tr className="border-b border-zinc-800 text-left text-xs text-zinc-500 uppercase">
                <th className="py-3 px-4">User</th>
                <th className="py-3 px-4">Items</th>
                <th className="py-3 px-4">Total</th>
                <th className="py-3 px-4">Status</th>
                <th className="py-3 px-4">Last Activity</th>
                <th className="py-3 px-4"></th>
              </tr>
            </thead>
            <tbody>
              {carts.map(cart => (
                <Fragment key={cart.id}>
                  <tr className="border-b border-zinc-800 hover:bg-zinc-800/50 transition-colors">
                    <td className="py-3 px-4 text-sm text-zinc-300">
                      {cart.email || (cart.anonymousId ? `Anon ${cart.anonymousId.slice(0, 8)}...` : "Unknown")}
                    </td>
                    <td className="py-3 px-4 text-sm text-zinc-300">{cart.itemCount}</td>
                    <td className="py-3 px-4 text-sm font-medium text-white">${Number(cart.totalCad).toFixed(2)}</td>
                    <td className="py-3 px-4">
                      <span className={`px-2 py-0.5 rounded-full text-xs font-medium ${statusColors[cart.status] || "bg-zinc-800 text-zinc-400"}`}>
                        {cart.status}
                      </span>
                    </td>
                    <td className="py-3 px-4 text-sm text-zinc-500">
                      {cart.lastActivityAt
                        ? new Date(cart.lastActivityAt).toLocaleDateString("en-CA", {
                            month: "short",
                            day: "numeric",
                            hour: "2-digit",
                            minute: "2-digit",
                          })
                        : "—"}
                    </td>
                    <td className="py-3 px-4 text-sm">
                      <button
                        onClick={() => setExpandedId(expandedId === cart.id ? null : cart.id)}
                        className="text-orange-500 hover:text-orange-400 transition-colors"
                      >
                        {expandedId === cart.id ? (
                          <ChevronUp className="w-5 h-5" />
                        ) : (
                          <ChevronDown className="w-5 h-5" />
                        )}
                      </button>
                    </td>
                  </tr>
                  {expandedId === cart.id && (
                    <tr className="border-b border-zinc-800 bg-zinc-800/30">
                      <td colSpan={6} className="py-4 px-6">
                        {cart.items.length === 0 ? (
                          <p className="text-zinc-500 text-sm">Cart is empty</p>
                        ) : (
                          <div className="space-y-3">
                            {cart.items.map((item, i) => (
                              <div
                                key={i}
                                className={`flex items-center gap-4 p-3 rounded-lg border ${
                                  item.itemType === "addon"
                                    ? "bg-green-900/10 border-green-800/30"
                                    : "bg-zinc-900/50 border-zinc-700/50"
                                }`}
                              >
                                {/* Product Image */}
                                {item.productImage && (
                                  <div className="relative w-14 h-14 rounded-md overflow-hidden bg-zinc-800 flex-shrink-0">
                                    <Image
                                      src={item.productImage}
                                      alt={item.productTitle}
                                      fill
                                      className="object-cover"
                                      sizes="56px"
                                    />
                                  </div>
                                )}

                                {/* Product Info */}
                                <div className="flex-1 min-w-0">
                                  <div className="flex items-center gap-2 flex-wrap">
                                    <span className="text-sm text-white font-medium truncate">
                                      {item.productTitle}
                                    </span>
                                    {item.itemType === "addon" && (
                                      <span className="inline-flex items-center gap-1 text-xs text-green-400 bg-green-900/30 px-2 py-0.5 rounded-full">
                                        <Sparkles className="w-3 h-3" />
                                        Add-on
                                      </span>
                                    )}
                                  </div>
                                  <div className="text-xs text-zinc-400 mt-0.5 space-x-3">
                                    <span>{item.variantTitle}</span>
                                    {item.selectedOption && (
                                      <span>Size: {item.selectedOption}</span>
                                    )}
                                    {item.sku && (
                                      <span className="font-mono">SKU: {item.sku}</span>
                                    )}
                                    {item.category && (
                                      <span>{item.category}</span>
                                    )}
                                  </div>
                                </div>

                                {/* Qty & Price */}
                                <div className="flex items-center gap-4 text-sm flex-shrink-0">
                                  <span className="text-zinc-400">
                                    &times;{item.quantity}
                                  </span>
                                  <div className="text-right">
                                    <div className="text-white font-medium">
                                      ${(
                                        (item.itemType === "addon" && item.addonPrice
                                          ? item.addonPrice
                                          : item.regularPrice) * item.quantity
                                      ).toFixed(2)}
                                    </div>
                                    {item.itemType === "addon" && item.addonPrice && (
                                      <div className="text-xs text-zinc-600 line-through">
                                        ${(item.regularPrice * item.quantity).toFixed(2)}
                                      </div>
                                    )}
                                  </div>
                                </div>
                              </div>
                            ))}
                          </div>
                        )}
                      </td>
                    </tr>
                  )}
                </Fragment>
              ))}
            </tbody>
          </table>
        </div>
      )}
    </div>
  )
}
