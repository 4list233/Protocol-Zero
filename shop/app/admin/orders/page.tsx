"use client"

import { useEffect, useState, Fragment, useCallback } from "react"
import { useAdminFetch } from "@/hooks/use-admin-fetch"
import {
  ShoppingBag,
  ChevronDown,
  ChevronUp,
  ExternalLink,
  User,
  Mail,
  Phone,
  Package,
  DollarSign,
  Clock,
  CheckCircle,
  XCircle,
  AlertCircle,
  Loader2,
  Tag,
  Sparkles,
} from "lucide-react"

// ============ TYPES ============

type OrderItem = {
  variantId: string
  productId: string
  productTitle: string
  variantTitle: string
  sku: string
  quantity: number
  unitPriceCad: number
  selectedSize?: string | null
  isAddon?: boolean
  regularPrice?: number
  addonPrice?: number
  taobaoLink?: string | null
  chineseName?: string | null
  costCad?: number
}

type Order = {
  id: string
  orderNumber: string
  customerName: string
  customerEmail: string
  customerPhone: string
  items: OrderItem[]
  itemCount: number
  subtotalCad: number
  shippingCad: number
  promoCode: string | null
  promoDiscountCad: number
  totalCad: number
  costCad: number
  profitCad: number
  paymentMethod: string
  paymentStatus: string
  etransferRef: string | null
  paymentReceivedAt: string | null
  status: string
  statusHistory: { status: string; at: string }[]
  createdAt: string | null
  updatedAt: string | null
}

// ============ CONSTANTS ============

const PAYMENT_STATUSES = ["Pending", "Received", "Refunded", "Cancelled"] as const
const ORDER_STATUSES = ["Placed", "Confirmed", "Processing", "Shipped", "Delivered", "Cancelled"] as const

const paymentStatusColors: Record<string, string> = {
  Pending: "bg-yellow-900/40 text-yellow-400 border border-yellow-800",
  Received: "bg-green-900/40 text-green-400 border border-green-800",
  Refunded: "bg-blue-900/40 text-blue-400 border border-blue-800",
  Cancelled: "bg-red-900/40 text-red-400 border border-red-800",
}

const orderStatusColors: Record<string, string> = {
  Placed: "bg-blue-900/40 text-blue-400 border border-blue-800",
  Confirmed: "bg-indigo-900/40 text-indigo-400 border border-indigo-800",
  Processing: "bg-orange-900/40 text-orange-400 border border-orange-800",
  Shipped: "bg-purple-900/40 text-purple-400 border border-purple-800",
  Delivered: "bg-green-900/40 text-green-400 border border-green-800",
  Cancelled: "bg-red-900/40 text-red-400 border border-red-800",
}

const paymentStatusIcons: Record<string, React.ElementType> = {
  Pending: Clock,
  Received: CheckCircle,
  Refunded: AlertCircle,
  Cancelled: XCircle,
}

// ============ COMPONENT ============

export default function OrdersPage() {
  const [orders, setOrders] = useState<Order[]>([])
  const [loading, setLoading] = useState(true)
  const [expandedId, setExpandedId] = useState<string | null>(null)
  const [expandedDetail, setExpandedDetail] = useState<Order | null>(null)
  const [detailLoading, setDetailLoading] = useState(false)
  const [statusFilter, setStatusFilter] = useState<string>("all")
  const [paymentFilter, setPaymentFilter] = useState<string>("all")
  const [updatingId, setUpdatingId] = useState<string | null>(null)
  const adminFetch = useAdminFetch()

  // Fetch orders list
  const fetchOrders = useCallback(() => {
    setLoading(true)
    const params = new URLSearchParams()
    if (statusFilter !== "all") params.set("status", statusFilter)
    if (paymentFilter !== "all") params.set("payment", paymentFilter)
    const qs = params.toString() ? `?${params.toString()}` : ""

    adminFetch(`/api/admin/orders${qs}`)
      .then(r => r?.ok ? r.json() : null)
      .then(data => {
        if (data?.orders) setOrders(data.orders)
      })
      .catch(() => {})
      .finally(() => setLoading(false))
  }, [adminFetch, statusFilter, paymentFilter])

  useEffect(() => {
    fetchOrders()
  }, [fetchOrders])

  // Fetch single order detail (with Taobao links)
  const toggleExpand = async (orderId: string) => {
    if (expandedId === orderId) {
      setExpandedId(null)
      setExpandedDetail(null)
      return
    }

    setExpandedId(orderId)
    setDetailLoading(true)

    try {
      const res = await adminFetch(`/api/admin/orders/${orderId}`)
      if (res?.ok) {
        const detail = await res.json()
        setExpandedDetail(detail)
      }
    } catch {
      // Fall back to list data
      const fallback = orders.find(o => o.id === orderId)
      if (fallback) setExpandedDetail(fallback)
    } finally {
      setDetailLoading(false)
    }
  }

  // Update payment status
  const updatePaymentStatus = async (orderId: string, newStatus: string) => {
    setUpdatingId(orderId)
    try {
      const res = await adminFetch(`/api/admin/orders/${orderId}`, {
        method: "PATCH",
        body: JSON.stringify({ paymentStatus: newStatus }),
      })
      if (res?.ok) {
        // Update local state
        setOrders(prev =>
          prev.map(o =>
            o.id === orderId
              ? {
                  ...o,
                  paymentStatus: newStatus,
                  paymentReceivedAt: newStatus === "Received" ? new Date().toISOString() : o.paymentReceivedAt,
                }
              : o
          )
        )
        if (expandedDetail?.id === orderId) {
          setExpandedDetail(prev =>
            prev
              ? {
                  ...prev,
                  paymentStatus: newStatus,
                  paymentReceivedAt: newStatus === "Received" ? new Date().toISOString() : prev.paymentReceivedAt,
                }
              : null
          )
        }
      }
    } catch {
      // Silently fail
    } finally {
      setUpdatingId(null)
    }
  }

  // Update order status
  const updateOrderStatus = async (orderId: string, newStatus: string) => {
    setUpdatingId(orderId)
    try {
      const res = await adminFetch(`/api/admin/orders/${orderId}`, {
        method: "PATCH",
        body: JSON.stringify({ status: newStatus }),
      })
      if (res?.ok) {
        setOrders(prev =>
          prev.map(o => (o.id === orderId ? { ...o, status: newStatus } : o))
        )
        if (expandedDetail?.id === orderId) {
          setExpandedDetail(prev => (prev ? { ...prev, status: newStatus } : null))
        }
      }
    } catch {
      // Silently fail
    } finally {
      setUpdatingId(null)
    }
  }

  // Stats
  const paidOrders = orders.filter(o => o.paymentStatus === "Received")
  const stats = {
    total: orders.length,
    pending: orders.filter(o => o.paymentStatus === "Pending").length,
    received: paidOrders.length,
    totalRevenue: paidOrders.reduce((sum, o) => sum + o.totalCad, 0),
    totalCost: paidOrders.reduce((sum, o) => sum + (o.costCad || 0), 0),
    totalProfit: paidOrders.reduce((sum, o) => sum + (o.profitCad || 0), 0),
  }

  return (
    <div className="space-y-6">
      {/* Header */}
      <div>
        <h1 className="text-2xl font-bold text-white flex items-center gap-3">
          <ShoppingBag className="w-6 h-6 text-orange-500" />
          Orders
        </h1>
        <p className="text-zinc-400 mt-1">Manage customer orders and payment status</p>
      </div>

      {/* Stats */}
      <div className="grid grid-cols-2 md:grid-cols-3 lg:grid-cols-6 gap-3">
        <div className="bg-zinc-900 border border-zinc-800 rounded-lg p-3">
          <div className="text-xs text-zinc-500 uppercase">Total Orders</div>
          <div className="text-xl font-bold text-white">{stats.total}</div>
        </div>
        <div className="bg-zinc-900 border border-zinc-800 rounded-lg p-3">
          <div className="text-xs text-yellow-500 uppercase">Pending Payment</div>
          <div className="text-xl font-bold text-yellow-400">{stats.pending}</div>
        </div>
        <div className="bg-zinc-900 border border-zinc-800 rounded-lg p-3">
          <div className="text-xs text-green-500 uppercase">Paid</div>
          <div className="text-xl font-bold text-green-400">{stats.received}</div>
        </div>
        <div className="bg-zinc-900 border border-zinc-800 rounded-lg p-3">
          <div className="text-xs text-orange-500 uppercase">Revenue</div>
          <div className="text-xl font-bold text-orange-400">${(stats.totalRevenue ?? 0).toFixed(2)}</div>
        </div>
        <div className="bg-zinc-900 border border-zinc-800 rounded-lg p-3">
          <div className="text-xs text-red-500 uppercase">Cost</div>
          <div className="text-xl font-bold text-red-400">${(stats.totalCost ?? 0).toFixed(2)}</div>
        </div>
        <div className="bg-zinc-900 border border-zinc-800 rounded-lg p-3">
          <div className={`text-xs uppercase ${(stats.totalProfit ?? 0) >= 0 ? "text-green-500" : "text-red-500"}`}>Profit</div>
          <div className={`text-xl font-bold ${(stats.totalProfit ?? 0) >= 0 ? "text-green-400" : "text-red-400"}`}>
            ${(stats.totalProfit ?? 0).toFixed(2)}
          </div>
        </div>
      </div>

      {/* Filters */}
      <div className="flex flex-wrap gap-4">
        <div>
          <label className="text-xs text-zinc-500 uppercase block mb-1">Order Status</label>
          <div className="flex gap-1 flex-wrap">
            {["all", ...ORDER_STATUSES].map(s => (
              <button
                key={s}
                onClick={() => setStatusFilter(s)}
                className={`px-3 py-1.5 rounded-lg text-xs transition-colors ${
                  statusFilter === s
                    ? "bg-orange-600 text-white"
                    : "bg-zinc-800 text-zinc-400 hover:bg-zinc-700 hover:text-white"
                }`}
              >
                {s === "all" ? "All" : s}
              </button>
            ))}
          </div>
        </div>
        <div>
          <label className="text-xs text-zinc-500 uppercase block mb-1">Payment</label>
          <div className="flex gap-1 flex-wrap">
            {["all", ...PAYMENT_STATUSES].map(s => (
              <button
                key={s}
                onClick={() => setPaymentFilter(s)}
                className={`px-3 py-1.5 rounded-lg text-xs transition-colors ${
                  paymentFilter === s
                    ? "bg-orange-600 text-white"
                    : "bg-zinc-800 text-zinc-400 hover:bg-zinc-700 hover:text-white"
                }`}
              >
                {s === "all" ? "All" : s}
              </button>
            ))}
          </div>
        </div>
      </div>

      {/* Orders Table */}
      {loading ? (
        <div className="flex items-center justify-center py-12">
          <div className="animate-spin rounded-full h-8 w-8 border-t-2 border-b-2 border-orange-500" />
        </div>
      ) : orders.length === 0 ? (
        <div className="text-center py-12 bg-zinc-900 rounded-lg border border-zinc-800">
          <ShoppingBag className="w-12 h-12 mx-auto text-zinc-600 mb-4" />
          <h2 className="text-lg font-semibold text-white mb-2">No Orders Found</h2>
          <p className="text-zinc-400 text-sm">
            {statusFilter !== "all" || paymentFilter !== "all"
              ? "Try adjusting your filters."
              : "Orders will appear here when customers place them."}
          </p>
        </div>
      ) : (
        <div className="bg-zinc-900 border border-zinc-800 rounded-lg overflow-hidden">
          <div className="overflow-x-auto">
            <table className="w-full">
              <thead>
                <tr className="border-b border-zinc-800 text-left text-xs text-zinc-500 uppercase">
                  <th className="py-3 px-4">Order</th>
                  <th className="py-3 px-4">Customer</th>
                  <th className="py-3 px-4">Items</th>
                  <th className="py-3 px-4">Total</th>
                  <th className="py-3 px-4">Profit</th>
                  <th className="py-3 px-4">Payment</th>
                  <th className="py-3 px-4">Status</th>
                  <th className="py-3 px-4">Date</th>
                  <th className="py-3 px-4"></th>
                </tr>
              </thead>
              <tbody>
                {orders.map(order => (
                  <Fragment key={order.id}>
                    {/* Order Row */}
                    <tr className="border-b border-zinc-800 hover:bg-zinc-800/50 transition-colors">
                      <td className="py-3 px-4">
                        <code className="text-orange-400 text-sm font-mono">{order.orderNumber}</code>
                      </td>
                      <td className="py-3 px-4">
                        <div className="text-sm text-white">{order.customerName || "—"}</div>
                        <div className="text-xs text-zinc-500">{order.customerEmail || "—"}</div>
                      </td>
                      <td className="py-3 px-4 text-sm text-zinc-300">{order.itemCount}</td>
                      <td className="py-3 px-4 text-sm font-medium text-white">
                        ${(Number(order.totalCad) || 0).toFixed(2)}
                      </td>
                      <td className="py-3 px-4 text-sm font-medium">
                        <span className={order.profitCad >= 0 ? "text-green-400" : "text-red-400"}>
                          ${(order.profitCad || 0).toFixed(2)}
                        </span>
                      </td>
                      <td className="py-3 px-4">
                        <span
                          className={`inline-flex items-center gap-1 px-2 py-0.5 rounded-full text-xs font-medium ${
                            paymentStatusColors[order.paymentStatus] || "bg-zinc-800 text-zinc-400"
                          }`}
                        >
                          {(() => {
                            const Icon = paymentStatusIcons[order.paymentStatus]
                            return Icon ? <Icon className="w-3 h-3" /> : null
                          })()}
                          {order.paymentStatus}
                        </span>
                      </td>
                      <td className="py-3 px-4">
                        <span
                          className={`px-2 py-0.5 rounded-full text-xs font-medium ${
                            orderStatusColors[order.status] || "bg-zinc-800 text-zinc-400"
                          }`}
                        >
                          {order.status}
                        </span>
                      </td>
                      <td className="py-3 px-4 text-sm text-zinc-500">
                        {order.createdAt
                          ? new Date(order.createdAt).toLocaleDateString("en-CA", {
                              month: "short",
                              day: "numeric",
                              year: "numeric",
                            })
                          : "—"}
                      </td>
                      <td className="py-3 px-4">
                        <button
                          onClick={() => toggleExpand(order.id)}
                          className="text-orange-500 hover:text-orange-400 transition-colors"
                        >
                          {expandedId === order.id ? (
                            <ChevronUp className="w-5 h-5" />
                          ) : (
                            <ChevronDown className="w-5 h-5" />
                          )}
                        </button>
                      </td>
                    </tr>

                    {/* Expanded Detail */}
                    {expandedId === order.id && (
                      <tr className="border-b border-zinc-800">
                        <td colSpan={9} className="p-0">
                          {detailLoading ? (
                            <div className="flex items-center justify-center py-8">
                              <Loader2 className="w-6 h-6 text-orange-500 animate-spin" />
                            </div>
                          ) : expandedDetail ? (
                            <OrderDetail
                              order={expandedDetail}
                              updatingId={updatingId}
                              onUpdatePayment={updatePaymentStatus}
                              onUpdateStatus={updateOrderStatus}
                            />
                          ) : null}
                        </td>
                      </tr>
                    )}
                  </Fragment>
                ))}
              </tbody>
            </table>
          </div>
        </div>
      )}
    </div>
  )
}

// ============ ORDER DETAIL COMPONENT ============

function OrderDetail({
  order,
  updatingId,
  onUpdatePayment,
  onUpdateStatus,
}: {
  order: Order
  updatingId: string | null
  onUpdatePayment: (id: string, status: string) => void
  onUpdateStatus: (id: string, status: string) => void
}) {
  const isUpdating = updatingId === order.id

  return (
    <div className="bg-zinc-800/30 p-6 space-y-6">
      <div className="grid grid-cols-1 md:grid-cols-3 gap-6">
        {/* Customer Info */}
        <div className="bg-zinc-900 rounded-lg border border-zinc-800 p-4">
          <h3 className="text-sm font-semibold text-white mb-3 flex items-center gap-2">
            <User className="w-4 h-4 text-orange-500" />
            Customer Details
          </h3>
          <div className="space-y-2 text-sm">
            <div className="flex items-center gap-2 text-zinc-300">
              <User className="w-3.5 h-3.5 text-zinc-500" />
              {order.customerName || "No name provided"}
            </div>
            <div className="flex items-center gap-2 text-zinc-300">
              <Mail className="w-3.5 h-3.5 text-zinc-500" />
              {order.customerEmail ? (
                <a
                  href={`mailto:${order.customerEmail}`}
                  className="text-orange-400 hover:text-orange-300 underline"
                >
                  {order.customerEmail}
                </a>
              ) : (
                "No email"
              )}
            </div>
            <div className="flex items-center gap-2 text-zinc-300">
              <Phone className="w-3.5 h-3.5 text-zinc-500" />
              {order.customerPhone ? (
                <a
                  href={`tel:${order.customerPhone}`}
                  className="text-orange-400 hover:text-orange-300 underline"
                >
                  {order.customerPhone}
                </a>
              ) : (
                "No phone"
              )}
            </div>
          </div>
        </div>

        {/* Payment Info */}
        <div className="bg-zinc-900 rounded-lg border border-zinc-800 p-4">
          <h3 className="text-sm font-semibold text-white mb-3 flex items-center gap-2">
            <DollarSign className="w-4 h-4 text-orange-500" />
            Payment
          </h3>
          <div className="space-y-3">
            <div className="text-sm text-zinc-400">
              Method: <span className="text-white">{order.paymentMethod || "e-transfer"}</span>
            </div>
            {order.promoCode && (
              <div className="text-sm text-zinc-400 flex items-center gap-1">
                <Tag className="w-3 h-3 text-green-400" />
                Promo: <span className="text-green-400 font-mono">{order.promoCode}</span>
                <span className="text-green-400">(-${(order.promoDiscountCad ?? 0).toFixed(2)})</span>
              </div>
            )}
            <div className="text-sm text-zinc-400">
              Subtotal: <span className="text-white">${(order.subtotalCad ?? 0).toFixed(2)}</span>
            </div>
            <div className="text-lg font-bold text-orange-400">
              Total: ${(Number(order.totalCad) || 0).toFixed(2)} CAD
            </div>
            {(order.costCad ?? 0) > 0 && (
              <div className="pt-2 border-t border-zinc-800 space-y-1">
                <div className="text-sm text-zinc-400">
                  Cost: <span className="text-red-400">${(order.costCad ?? 0).toFixed(2)}</span>
                </div>
                <div className="text-sm font-medium">
                  Profit:{" "}
                  <span className={(order.profitCad ?? 0) >= 0 ? "text-green-400" : "text-red-400"}>
                    ${(order.profitCad ?? 0).toFixed(2)}
                  </span>
                </div>
              </div>
            )}
            {order.paymentReceivedAt && (
              <div className="text-xs text-green-400">
                Paid on {new Date(order.paymentReceivedAt).toLocaleDateString("en-CA", {
                  month: "short",
                  day: "numeric",
                  year: "numeric",
                  hour: "2-digit",
                  minute: "2-digit",
                })}
              </div>
            )}

            {/* Payment Status Selector */}
            <div>
              <label className="text-xs text-zinc-500 uppercase block mb-1">Payment Status</label>
              <select
                value={order.paymentStatus}
                onChange={e => onUpdatePayment(order.id, e.target.value)}
                disabled={isUpdating}
                className="w-full bg-zinc-800 border border-zinc-700 rounded-lg px-3 py-2 text-sm text-white focus:outline-none focus:border-orange-500 disabled:opacity-50"
              >
                {PAYMENT_STATUSES.map(s => (
                  <option key={s} value={s}>
                    {s}
                  </option>
                ))}
              </select>
            </div>
          </div>
        </div>

        {/* Order Status */}
        <div className="bg-zinc-900 rounded-lg border border-zinc-800 p-4">
          <h3 className="text-sm font-semibold text-white mb-3 flex items-center gap-2">
            <Package className="w-4 h-4 text-orange-500" />
            Order Status
          </h3>
          <div className="space-y-3">
            <div>
              <label className="text-xs text-zinc-500 uppercase block mb-1">Status</label>
              <select
                value={order.status}
                onChange={e => onUpdateStatus(order.id, e.target.value)}
                disabled={isUpdating}
                className="w-full bg-zinc-800 border border-zinc-700 rounded-lg px-3 py-2 text-sm text-white focus:outline-none focus:border-orange-500 disabled:opacity-50"
              >
                {ORDER_STATUSES.map(s => (
                  <option key={s} value={s}>
                    {s}
                  </option>
                ))}
              </select>
            </div>

            {/* Status History */}
            {order.statusHistory && order.statusHistory.length > 0 && (
              <div>
                <div className="text-xs text-zinc-500 uppercase mb-2">History</div>
                <div className="space-y-1">
                  {order.statusHistory.map((h, i) => (
                    <div key={i} className="flex items-center justify-between text-xs">
                      <span className="text-zinc-300">{h.status}</span>
                      <span className="text-zinc-500">
                        {new Date(h.at).toLocaleDateString("en-CA", {
                          month: "short",
                          day: "numeric",
                          hour: "2-digit",
                          minute: "2-digit",
                        })}
                      </span>
                    </div>
                  ))}
                </div>
              </div>
            )}
          </div>
        </div>
      </div>

      {/* Order Items */}
      <div className="bg-zinc-900 rounded-lg border border-zinc-800 p-4">
        <h3 className="text-sm font-semibold text-white mb-3 flex items-center gap-2">
          <ShoppingBag className="w-4 h-4 text-orange-500" />
          Order Items ({order.items.length})
        </h3>
        <div className="space-y-3">
          {order.items.map((item, i) => (
            <div
              key={i}
              className={`flex flex-col md:flex-row md:items-center justify-between gap-3 p-3 rounded-lg border ${
                item.isAddon
                  ? "bg-green-900/10 border-green-800/30"
                  : "bg-zinc-800/50 border-zinc-700/50"
              }`}
            >
              <div className="flex-1 min-w-0">
                <div className="flex items-center gap-2 flex-wrap">
                  <span className="text-white font-medium text-sm">{item.productTitle}</span>
                  {item.isAddon && (
                    <span className="inline-flex items-center gap-1 text-xs text-green-400 bg-green-900/30 px-2 py-0.5 rounded-full">
                      <Sparkles className="w-3 h-3" />
                      Add-on
                    </span>
                  )}
                </div>
                <div className="text-xs text-zinc-400 mt-1 space-y-0.5">
                  <div>
                    Variant: <span className="text-zinc-300">{item.variantTitle}</span>
                  </div>
                  {item.selectedSize && (
                    <div>
                      Size/Option: <span className="text-zinc-300">{item.selectedSize}</span>
                    </div>
                  )}
                  {item.chineseName && (
                    <div>
                      Chinese: <span className="text-zinc-300">{item.chineseName}</span>
                    </div>
                  )}
                  {item.costCad !== undefined && item.costCad > 0 && (
                    <div>
                      Cost: <span className="text-zinc-300">${(item.costCad ?? 0).toFixed(2)}/unit</span>
                    </div>
                  )}
                </div>

                {/* Taobao Link */}
                {item.taobaoLink && (
                  <a
                    href={item.taobaoLink}
                    target="_blank"
                    rel="noopener noreferrer"
                    className="inline-flex items-center gap-1.5 mt-1.5 text-xs text-red-400 hover:text-red-300 underline transition-colors"
                  >
                    <ExternalLink className="w-3 h-3" />
                    Taobao Link
                  </a>
                )}
              </div>

              <div className="flex items-center gap-4 text-sm">
                <div className="text-zinc-400">
                  Qty: <span className="text-white font-medium">{item.quantity}</span>
                </div>
                <div className="text-zinc-400">
                  @{" "}
                  <span className="text-white">${(item.unitPriceCad ?? 0).toFixed(2)}</span>
                  {item.isAddon && item.regularPrice && (
                    <span className="text-zinc-600 line-through ml-1">
                      ${(item.regularPrice ?? 0).toFixed(2)}
                    </span>
                  )}
                </div>
                <div className="text-orange-400 font-medium whitespace-nowrap">
                  ${((item.unitPriceCad ?? 0) * item.quantity).toFixed(2)}
                </div>
              </div>
            </div>
          ))}
        </div>
      </div>
    </div>
  )
}
