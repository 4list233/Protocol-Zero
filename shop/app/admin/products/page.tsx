"use client"

import { useEffect, useState, useCallback } from "react"
import Link from "next/link"
import Image from "next/image"
import { useSearchParams, useRouter } from "next/navigation"
import {
  Search,
  Filter,
  ChevronLeft,
  ChevronRight,
  Edit,
  Eye,
  Package,
  AlertCircle,
} from "lucide-react"

type Product = {
  id: string
  sku: string
  title: string
  titleOriginal?: string
  status: string
  category?: string
  priceCadBase: number
  primaryImage?: string
  variantCount: number
  updatedAt: string
}

type Filters = {
  status: string
  category: string
  search: string
}

export default function AdminProductsPage() {
  const router = useRouter()
  const searchParams = useSearchParams()

  const [products, setProducts] = useState<Product[]>([])
  const [loading, setLoading] = useState(true)
  const [error, setError] = useState<string | null>(null)
  const [totalProducts, setTotalProducts] = useState(0)
  const [page, setPage] = useState(1)
  const [filters, setFilters] = useState<Filters>({
    status: searchParams.get("status") || "",
    category: searchParams.get("category") || "",
    search: searchParams.get("search") || "",
  })

  const pageSize = 20

  const fetchProducts = useCallback(async () => {
    setLoading(true)
    setError(null)

    try {
      const params = new URLSearchParams()
      params.set("page", page.toString())
      params.set("limit", pageSize.toString())
      if (filters.status) params.set("status", filters.status)
      if (filters.category) params.set("category", filters.category)
      if (filters.search) params.set("search", filters.search)

      const res = await fetch(`/api/admin/products?${params}`)
      if (!res.ok) throw new Error("Failed to fetch products")

      const data = await res.json()
      setProducts(data.products || [])
      setTotalProducts(data.pagination?.total || 0)
    } catch (err) {
      setError("Failed to load products. Please try again.")
      console.error(err)
    } finally {
      setLoading(false)
    }
  }, [page, filters])

  useEffect(() => {
    fetchProducts()
  }, [fetchProducts])

  const handleSearch = (e: React.FormEvent) => {
    e.preventDefault()
    setPage(1)
    // Update URL params
    const params = new URLSearchParams()
    if (filters.status) params.set("status", filters.status)
    if (filters.category) params.set("category", filters.category)
    if (filters.search) params.set("search", filters.search)
    router.push(`/admin/products?${params}`)
  }

  const handleFilterChange = (key: keyof Filters, value: string) => {
    setFilters((prev) => ({ ...prev, [key]: value }))
    setPage(1)
  }

  const totalPages = Math.ceil(totalProducts / pageSize)

  return (
    <div className="space-y-6">
      {/* Header */}
      <div className="flex items-center justify-between">
        <div>
          <h1 className="text-2xl font-bold text-white">Products</h1>
          <p className="text-zinc-400 mt-1">
            Manage your product catalog ({totalProducts} products)
          </p>
        </div>
      </div>

      {/* Filters */}
      <div className="bg-zinc-900 rounded-lg border border-zinc-800 p-4">
        <form onSubmit={handleSearch} className="flex flex-wrap gap-4">
          {/* Search */}
          <div className="flex-1 min-w-[200px]">
            <div className="relative">
              <Search className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-zinc-500" />
              <input
                type="text"
                placeholder="Search products..."
                value={filters.search}
                onChange={(e) => handleFilterChange("search", e.target.value)}
                className="w-full pl-10 pr-4 py-2 bg-zinc-800 border border-zinc-700 rounded-lg text-white placeholder:text-zinc-500 focus:outline-none focus:border-orange-500"
              />
            </div>
          </div>

          {/* Status Filter */}
          <div className="w-40">
            <select
              value={filters.status}
              onChange={(e) => handleFilterChange("status", e.target.value)}
              className="w-full px-4 py-2 bg-zinc-800 border border-zinc-700 rounded-lg text-white focus:outline-none focus:border-orange-500"
            >
              <option value="">All Status</option>
              <option value="Active">Active</option>
              <option value="Draft">Draft</option>
              <option value="Archived">Archived</option>
            </select>
          </div>

          {/* Category Filter */}
          <div className="w-40">
            <select
              value={filters.category}
              onChange={(e) => handleFilterChange("category", e.target.value)}
              className="w-full px-4 py-2 bg-zinc-800 border border-zinc-700 rounded-lg text-white focus:outline-none focus:border-orange-500"
            >
              <option value="">All Categories</option>
              <option value="Vests">Vests</option>
              <option value="Helmets">Helmets</option>
              <option value="Pouches">Pouches</option>
              <option value="Accessories">Accessories</option>
              <option value="Clothing">Clothing</option>
            </select>
          </div>

          {/* Search Button */}
          <button
            type="submit"
            className="px-4 py-2 bg-orange-600 hover:bg-orange-500 text-white rounded-lg transition-colors flex items-center gap-2"
          >
            <Filter className="w-4 h-4" />
            Filter
          </button>
        </form>
      </div>

      {/* Error */}
      {error && (
        <div className="bg-red-900/20 border border-red-800 rounded-lg p-4 flex items-center gap-3">
          <AlertCircle className="w-5 h-5 text-red-400 flex-shrink-0" />
          <p className="text-red-400">{error}</p>
        </div>
      )}

      {/* Products Table */}
      <div className="bg-zinc-900 rounded-lg border border-zinc-800 overflow-hidden">
        {loading ? (
          <div className="flex items-center justify-center h-64">
            <div className="animate-spin rounded-full h-8 w-8 border-t-2 border-b-2 border-orange-500"></div>
          </div>
        ) : products.length > 0 ? (
          <div className="overflow-x-auto">
            <table className="w-full">
              <thead className="bg-zinc-800/50">
                <tr>
                  <th className="px-4 py-3 text-left text-xs font-medium text-zinc-400 uppercase tracking-wider">
                    Product
                  </th>
                  <th className="px-4 py-3 text-left text-xs font-medium text-zinc-400 uppercase tracking-wider">
                    SKU
                  </th>
                  <th className="px-4 py-3 text-left text-xs font-medium text-zinc-400 uppercase tracking-wider">
                    Category
                  </th>
                  <th className="px-4 py-3 text-left text-xs font-medium text-zinc-400 uppercase tracking-wider">
                    Price
                  </th>
                  <th className="px-4 py-3 text-left text-xs font-medium text-zinc-400 uppercase tracking-wider">
                    Variants
                  </th>
                  <th className="px-4 py-3 text-left text-xs font-medium text-zinc-400 uppercase tracking-wider">
                    Status
                  </th>
                  <th className="px-4 py-3 text-right text-xs font-medium text-zinc-400 uppercase tracking-wider">
                    Actions
                  </th>
                </tr>
              </thead>
              <tbody className="divide-y divide-zinc-800">
                {products.map((product) => (
                  <tr key={product.id} className="hover:bg-zinc-800/30 transition-colors">
                    <td className="px-4 py-4">
                      <div className="flex items-center gap-3">
                        <div className="w-12 h-12 bg-zinc-800 rounded-lg overflow-hidden flex-shrink-0">
                          {product.primaryImage ? (
                            <Image
                              src={product.primaryImage}
                              alt={product.title}
                              width={48}
                              height={48}
                              className="w-full h-full object-cover"
                            />
                          ) : (
                            <div className="w-full h-full flex items-center justify-center">
                              <Package className="w-5 h-5 text-zinc-600" />
                            </div>
                          )}
                        </div>
                        <div className="min-w-0">
                          <p className="text-white font-medium truncate max-w-[250px]">
                            {product.title}
                          </p>
                          {product.titleOriginal && (
                            <p className="text-xs text-zinc-500 truncate max-w-[250px]">
                              {product.titleOriginal}
                            </p>
                          )}
                        </div>
                      </div>
                    </td>
                    <td className="px-4 py-4">
                      <code className="text-xs text-zinc-400 bg-zinc-800 px-2 py-1 rounded">
                        {product.sku}
                      </code>
                    </td>
                    <td className="px-4 py-4 text-zinc-400">
                      {product.category || "-"}
                    </td>
                    <td className="px-4 py-4 text-white">
                      ${product.priceCadBase?.toFixed(2) ?? "0.00"}
                    </td>
                    <td className="px-4 py-4 text-zinc-400">
                      {product.variantCount} variants
                    </td>
                    <td className="px-4 py-4">
                      <span
                        className={`px-2 py-1 text-xs rounded-full ${
                          product.status === "Active"
                            ? "bg-green-900/30 text-green-400"
                            : product.status === "Draft"
                            ? "bg-yellow-900/30 text-yellow-400"
                            : "bg-zinc-700 text-zinc-400"
                        }`}
                      >
                        {product.status}
                      </span>
                    </td>
                    <td className="px-4 py-4">
                      <div className="flex items-center justify-end gap-2">
                        <Link
                          href={`/shop/${product.id}`}
                          target="_blank"
                          className="p-2 text-zinc-400 hover:text-white hover:bg-zinc-800 rounded-lg transition-colors"
                          title="View on site"
                        >
                          <Eye className="w-4 h-4" />
                        </Link>
                        <Link
                          href={`/admin/products/${product.id}`}
                          className="p-2 text-zinc-400 hover:text-orange-500 hover:bg-zinc-800 rounded-lg transition-colors"
                          title="Edit"
                        >
                          <Edit className="w-4 h-4" />
                        </Link>
                      </div>
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        ) : (
          <div className="p-12 text-center">
            <Package className="w-12 h-12 mx-auto text-zinc-600 mb-4" />
            <p className="text-zinc-400">No products found</p>
            <p className="text-sm text-zinc-500 mt-1">
              Try adjusting your filters or run the scraper to add products.
            </p>
          </div>
        )}
      </div>

      {/* Pagination */}
      {totalPages > 1 && (
        <div className="flex items-center justify-between">
          <p className="text-sm text-zinc-500">
            Showing {(page - 1) * pageSize + 1} to{" "}
            {Math.min(page * pageSize, totalProducts)} of {totalProducts} products
          </p>
          <div className="flex items-center gap-2">
            <button
              onClick={() => setPage((p) => Math.max(1, p - 1))}
              disabled={page === 1}
              className="p-2 text-zinc-400 hover:text-white hover:bg-zinc-800 rounded-lg transition-colors disabled:opacity-50 disabled:cursor-not-allowed"
            >
              <ChevronLeft className="w-5 h-5" />
            </button>
            <span className="text-zinc-400">
              Page {page} of {totalPages}
            </span>
            <button
              onClick={() => setPage((p) => Math.min(totalPages, p + 1))}
              disabled={page === totalPages}
              className="p-2 text-zinc-400 hover:text-white hover:bg-zinc-800 rounded-lg transition-colors disabled:opacity-50 disabled:cursor-not-allowed"
            >
              <ChevronRight className="w-5 h-5" />
            </button>
          </div>
        </div>
      )}
    </div>
  )
}
