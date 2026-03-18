"use client"

import { useEffect, useState } from "react"
import Link from "next/link"
import { Package, ShoppingCart, DollarSign, AlertCircle, ArrowRight } from "lucide-react"
import { useAdminFetch } from "@/hooks/use-admin-fetch"

type Stats = {
  totalProducts: number
  activeProducts: number
  draftProducts: number
  totalOrders: number
  pendingOrders: number
  totalRevenue: number
  totalCost: number
  totalProfit: number
  totalPromoDiscount: number
}

type RecentProduct = {
  id: string
  title: string
  status: string
  priceCadBase: number
  updatedAt: string
}

export default function AdminDashboard() {
  const [stats, setStats] = useState<Stats | null>(null)
  const [recentProducts, setRecentProducts] = useState<RecentProduct[]>([])
  const [loading, setLoading] = useState(true)
  const [error, setError] = useState<string | null>(null)
  const adminFetch = useAdminFetch()

  useEffect(() => {
    async function fetchData() {
      try {
        // Fetch stats (includes recentProducts)
        const statsRes = await adminFetch("/api/admin/stats")
        if (statsRes.ok) {
          const statsData = await statsRes.json()
          setStats(statsData)
          setRecentProducts(statsData.recentProducts || [])
        }
      } catch (err) {
        setError("Failed to load dashboard data")
        console.error(err)
      } finally {
        setLoading(false)
      }
    }

    fetchData()
  }, [adminFetch])

  if (loading) {
    return (
      <div className="flex items-center justify-center h-64">
        <div className="animate-spin rounded-full h-8 w-8 border-t-2 border-b-2 border-orange-500"></div>
      </div>
    )
  }

  return (
    <div className="space-y-8">
      {/* Header */}
      <div>
        <h1 className="text-2xl font-bold text-white">Dashboard</h1>
        <p className="text-zinc-400 mt-1">Welcome to the Protocol Zero admin panel.</p>
      </div>

      {/* Error banner */}
      {error && (
        <div className="bg-red-900/20 border border-red-800 rounded-lg p-4 flex items-center gap-3">
          <AlertCircle className="w-5 h-5 text-red-400 flex-shrink-0" />
          <p className="text-red-400">{error}</p>
        </div>
      )}

      {/* Stats Grid */}
      <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-4">
        <StatCard
          title="Total Products"
          value={stats?.totalProducts ?? "-"}
          icon={Package}
          href="/admin/products"
        />
        <StatCard
          title="Active Products"
          value={stats?.activeProducts ?? "-"}
          icon={Package}
          color="green"
        />
        <StatCard
          title="Pending Orders"
          value={stats?.pendingOrders ?? "-"}
          icon={ShoppingCart}
          color="orange"
          href="/admin/orders?payment=Pending"
        />
        <StatCard
          title="Total Orders"
          value={stats?.totalOrders ?? "-"}
          icon={ShoppingCart}
          href="/admin/orders"
        />
      </div>

      {/* Financial Stats */}
      <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-4">
        <StatCard
          title="Revenue (Paid)"
          value={stats ? `$${stats.totalRevenue.toFixed(2)}` : "-"}
          icon={DollarSign}
          color="green"
        />
        <StatCard
          title="Cost of Goods"
          value={stats ? `$${stats.totalCost.toFixed(2)}` : "-"}
          icon={DollarSign}
          color="orange"
        />
        <StatCard
          title="Profit"
          value={stats ? `$${stats.totalProfit.toFixed(2)}` : "-"}
          icon={DollarSign}
          color={stats && stats.totalProfit > 0 ? "green" : "yellow"}
        />
        <StatCard
          title="Promo Discounts"
          value={stats ? `$${stats.totalPromoDiscount.toFixed(2)}` : "-"}
          icon={AlertCircle}
          color="yellow"
        />
      </div>

      {/* Quick Actions */}
      <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
        {/* Recent Products */}
        <div className="bg-zinc-900 rounded-lg border border-zinc-800">
          <div className="p-4 border-b border-zinc-800 flex items-center justify-between">
            <h2 className="text-lg font-semibold text-white">Recent Products</h2>
            <Link
              href="/admin/products"
              className="text-sm text-orange-500 hover:text-orange-400 flex items-center gap-1"
            >
              View All <ArrowRight className="w-4 h-4" />
            </Link>
          </div>
          <div className="divide-y divide-zinc-800">
            {recentProducts.length > 0 ? (
              recentProducts.map((product) => (
                <Link
                  key={product.id}
                  href={`/admin/products/${product.id}`}
                  className="flex items-center justify-between p-4 hover:bg-zinc-800/50 transition-colors"
                >
                  <div>
                    <p className="text-white font-medium truncate max-w-[200px]">
                      {product.title}
                    </p>
                    <p className="text-sm text-zinc-500">
                      ${product.priceCadBase?.toFixed(2) ?? "0.00"} CAD
                    </p>
                  </div>
                  <span
                    className={`px-2 py-1 text-xs rounded-full ${
                      product.status === "Active"
                        ? "bg-green-900/30 text-green-400"
                        : "bg-yellow-900/30 text-yellow-400"
                    }`}
                  >
                    {product.status}
                  </span>
                </Link>
              ))
            ) : (
              <div className="p-8 text-center text-zinc-500">
                <Package className="w-8 h-8 mx-auto mb-2 opacity-50" />
                <p>No products yet</p>
              </div>
            )}
          </div>
        </div>

        {/* Quick Actions Panel */}
        <div className="bg-zinc-900 rounded-lg border border-zinc-800">
          <div className="p-4 border-b border-zinc-800">
            <h2 className="text-lg font-semibold text-white">Quick Actions</h2>
          </div>
          <div className="p-4 space-y-3">
            <Link
              href="/admin/products"
              className="flex items-center gap-3 p-3 bg-zinc-800 hover:bg-zinc-700 rounded-lg transition-colors"
            >
              <Package className="w-5 h-5 text-orange-500" />
              <span className="text-white">Manage Products</span>
            </Link>
            <Link
              href="/admin/orders"
              className="flex items-center gap-3 p-3 bg-zinc-800 hover:bg-zinc-700 rounded-lg transition-colors"
            >
              <ShoppingCart className="w-5 h-5 text-orange-500" />
              <span className="text-white">View Orders</span>
            </Link>
            <Link
              href="/admin/carts"
              className="flex items-center gap-3 p-3 bg-zinc-800 hover:bg-zinc-700 rounded-lg transition-colors"
            >
              <ShoppingCart className="w-5 h-5 text-orange-500" />
              <span className="text-white">View Carts</span>
            </Link>
            <a
              href="https://builder.knack.com"
              target="_blank"
              rel="noopener noreferrer"
              className="flex items-center gap-3 p-3 bg-zinc-800 hover:bg-zinc-700 rounded-lg transition-colors"
            >
              <DollarSign className="w-5 h-5 text-orange-500" />
              <span className="text-white">Open Knack Dashboard</span>
            </a>
          </div>
        </div>
      </div>

      {/* Info Banner */}
      <div className="bg-blue-900/20 border border-blue-800 rounded-lg p-4">
        <h3 className="text-blue-400 font-medium mb-2">Getting Started</h3>
        <p className="text-zinc-400 text-sm">
          Use the Products page to edit product details, prices, and images.
          All changes are saved directly to Knack and will appear on the storefront immediately.
        </p>
      </div>
    </div>
  )
}

function StatCard({
  title,
  value,
  icon: Icon,
  color = "default",
  href,
}: {
  title: string
  value: number | string
  icon: React.ElementType
  color?: "default" | "green" | "yellow" | "orange"
  href?: string
}) {
  const colorClasses = {
    default: "bg-zinc-800 text-zinc-400",
    green: "bg-green-900/30 text-green-400",
    yellow: "bg-yellow-900/30 text-yellow-400",
    orange: "bg-orange-900/30 text-orange-400",
  }

  const content = (
    <div className="bg-zinc-900 rounded-lg border border-zinc-800 p-4 hover:border-zinc-700 transition-colors">
      <div className="flex items-center justify-between">
        <div>
          <p className="text-sm text-zinc-500">{title}</p>
          <p className="text-2xl font-bold text-white mt-1">{value}</p>
        </div>
        <div className={`p-3 rounded-lg ${colorClasses[color]}`}>
          <Icon className="w-5 h-5" />
        </div>
      </div>
    </div>
  )

  if (href) {
    return <Link href={href}>{content}</Link>
  }

  return content
}
