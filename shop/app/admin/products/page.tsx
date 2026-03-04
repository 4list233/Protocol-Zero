"use client"

import { useEffect, useState, useCallback, useRef } from "react"
import Link from "next/link"
import Image from "next/image"
import { useSearchParams, useRouter } from "next/navigation"
import {
  Search,
  Filter,
  ChevronLeft,
  ChevronRight,
  Eye,
  Package,
  AlertCircle,
  Check,
  X,
  Loader2,
  Save,
  ExternalLink,
} from "lucide-react"
import {
  getAdminCategories,
  saveCustomCategory,
} from "@/lib/admin-categories"
import { useAdminFetch } from "@/hooks/use-admin-fetch"

type Product = {
  id: string
  knackId: string
  sku: string
  title: string
  titleOriginal?: string
  description?: string
  status: string
  category: string
  priceCadBase: number
  priceMin: number
  priceMax: number
  primaryImage?: string
  variantCount: number
  url?: string
}

type Filters = {
  status: string
  category: string
  search: string
}

// Tracks which fields in a row have been edited (dirty)
type EditState = Partial<Pick<Product, "title" | "description" | "status" | "category">>

export default function AdminProductsPage() {
  const router = useRouter()
  const searchParams = useSearchParams()

  const [products, setProducts] = useState<Product[]>([])
  const [loading, setLoading] = useState(true)
  const [error, setError] = useState<string | null>(null)
  const [success, setSuccess] = useState<string | null>(null)
  const [totalProducts, setTotalProducts] = useState(0)
  const [page, setPage] = useState(1)
  const [filters, setFilters] = useState<Filters>({
    status: searchParams.get("status") || "",
    category: searchParams.get("category") || "",
    search: searchParams.get("search") || "",
  })
  const [serverCategories, setServerCategories] = useState<string[]>([])
  const [adminCategories, setAdminCategories] = useState<string[]>([])
  // Map of product ID → dirty fields
  const [edits, setEdits] = useState<Record<string, EditState>>({})
  const [savingIds, setSavingIds] = useState<Set<string>>(new Set())
  const adminFetch = useAdminFetch()

  const pageSize = 20

  useEffect(() => {
    setAdminCategories(getAdminCategories())
  }, [])

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

      const res = await adminFetch(`/api/admin/products?${params}`)
      if (!res.ok) throw new Error("Failed to fetch products")

      const data = await res.json()
      setProducts(data.products || [])
      setTotalProducts(data.pagination?.total || 0)
      if (data.filters?.categories) setServerCategories(data.filters.categories)
      setEdits({})
    } catch (err) {
      setError("Failed to load products. Please try again.")
      console.error(err)
    } finally {
      setLoading(false)
    }
  }, [page, filters, adminFetch])

  useEffect(() => {
    fetchProducts()
  }, [fetchProducts])

  const handleSearch = (e: React.FormEvent) => {
    e.preventDefault()
    setPage(1)
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

  // --- Inline edit helpers ---
  const getEdited = (product: Product): Product & EditState => {
    const e = edits[product.id]
    return e ? { ...product, ...e } : product
  }

  const setField = (productId: string, field: keyof EditState, value: string) => {
    setEdits((prev) => ({
      ...prev,
      [productId]: { ...prev[productId], [field]: value },
    }))
  }

  const isDirty = (productId: string) => {
    const e = edits[productId]
    return e && Object.keys(e).length > 0
  }

  const discardEdits = (productId: string) => {
    setEdits((prev) => {
      const next = { ...prev }
      delete next[productId]
      return next
    })
  }

  const saveProduct = async (product: Product) => {
    const e = edits[product.id]
    if (!e || Object.keys(e).length === 0) return

    setSavingIds((prev) => new Set(prev).add(product.id))
    setError(null)
    setSuccess(null)

    try {
      const res = await adminFetch(`/api/admin/products/${product.id}`, {
        method: "PUT",
        body: JSON.stringify(e),
      })

      if (!res.ok) {
        const data = await res.json()
        throw new Error(data.error || "Failed to save")
      }

      // Persist any new categories
      if (e.category) {
        e.category.split(",").forEach((c) => {
          const trimmed = c.trim()
          if (trimmed) saveCustomCategory(trimmed)
        })
        setAdminCategories(getAdminCategories())
      }

      setProducts((prev) =>
        prev.map((p) => (p.id === product.id ? { ...p, ...e } : p))
      )
      discardEdits(product.id)
      setSuccess(`${product.title || "Product"} saved`)
      setTimeout(() => setSuccess(null), 3000)
    } catch (err) {
      setError(err instanceof Error ? err.message : "Failed to save")
    } finally {
      setSavingIds((prev) => {
        const next = new Set(prev)
        next.delete(product.id)
        return next
      })
    }
  }

  const allCategories = Array.from(
    new Set([...serverCategories, ...adminCategories].filter(Boolean))
  ).sort()

  const totalPages = Math.ceil(totalProducts / pageSize)

  return (
    <div className="space-y-6">
      {/* Header */}
      <div className="flex items-center justify-between">
        <div>
          <h1 className="text-2xl font-bold text-white">Products</h1>
          <p className="text-zinc-400 mt-1">
            Manage your product catalog ({totalProducts} products) &mdash; edit inline &amp; save
          </p>
        </div>
      </div>

      {/* Filters */}
      <div className="bg-zinc-900 rounded-lg border border-zinc-800 p-4">
        <form onSubmit={handleSearch} className="flex flex-wrap gap-4">
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

          <div className="w-48">
            <select
              value={filters.category}
              onChange={(e) => handleFilterChange("category", e.target.value)}
              className="w-full px-4 py-2 bg-zinc-800 border border-zinc-700 rounded-lg text-white focus:outline-none focus:border-orange-500"
            >
              <option value="">All Categories</option>
              {allCategories.map((cat) => (
                <option key={cat} value={cat}>
                  {cat}
                </option>
              ))}
            </select>
          </div>

          <button
            type="submit"
            className="px-4 py-2 bg-orange-600 hover:bg-orange-500 text-white rounded-lg transition-colors flex items-center gap-2"
          >
            <Filter className="w-4 h-4" />
            Filter
          </button>
        </form>
      </div>

      {/* Alerts */}
      {error && (
        <div className="bg-red-900/20 border border-red-800 rounded-lg p-4 flex items-center gap-3">
          <AlertCircle className="w-5 h-5 text-red-400 flex-shrink-0" />
          <p className="text-red-400">{error}</p>
        </div>
      )}
      {success && (
        <div className="bg-green-900/20 border border-green-800 rounded-lg p-4 flex items-center gap-3">
          <Check className="w-5 h-5 text-green-400 flex-shrink-0" />
          <p className="text-green-400">{success}</p>
        </div>
      )}

      {/* Products */}
      <div className="space-y-3">
        {loading ? (
          <div className="flex items-center justify-center h-64">
            <div className="animate-spin rounded-full h-8 w-8 border-t-2 border-b-2 border-orange-500" />
          </div>
        ) : products.length > 0 ? (
          products.map((product) => {
            const p = getEdited(product)
            const dirty = isDirty(product.id)
            const saving = savingIds.has(product.id)
            return (
              <ProductRow
                key={product.id}
                original={product}
                edited={p}
                dirty={dirty}
                saving={saving}
                allCategories={allCategories}
                onFieldChange={(field, value) => setField(product.id, field, value)}
                onSave={() => saveProduct(product)}
                onDiscard={() => discardEdits(product.id)}
              />
            )
          })
        ) : (
          <div className="bg-zinc-900 rounded-lg border border-zinc-800 p-12 text-center">
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

// ---------------------------------------------------------------------------
// Inline-editable product row
// ---------------------------------------------------------------------------
function ProductRow({
  original,
  edited,
  dirty,
  saving,
  allCategories,
  onFieldChange,
  onSave,
  onDiscard,
}: {
  original: Product
  edited: Product & Partial<Product>
  dirty: boolean
  saving: boolean
  allCategories: string[]
  onFieldChange: (field: "title" | "description" | "status" | "category", value: string) => void
  onSave: () => void
  onDiscard: () => void
}) {
  const [catInput, setCatInput] = useState("")
  const catInputRef = useRef<HTMLInputElement>(null)

  // Parse categories as an array of tags
  const categories = (edited.category || "")
    .split(",")
    .map((c) => c.trim())
    .filter(Boolean)

  const addCategory = (cat: string) => {
    const trimmed = cat.trim()
    if (!trimmed) return
    if (categories.includes(trimmed)) return
    const updated = [...categories, trimmed].join(", ")
    onFieldChange("category", updated)
    setCatInput("")
  }

  const removeCategory = (cat: string) => {
    const updated = categories.filter((c) => c !== cat).join(", ")
    onFieldChange("category", updated)
  }

  const handleCatKeyDown = (e: React.KeyboardEvent) => {
    if (e.key === "Enter" || e.key === ",") {
      e.preventDefault()
      addCategory(catInput)
    }
    if (e.key === "Backspace" && catInput === "" && categories.length > 0) {
      removeCategory(categories[categories.length - 1])
    }
  }

  // Price display
  const priceDisplay = (() => {
    if (original.priceMin === 0 && original.priceMax === 0) {
      return <span className="text-zinc-500">No price</span>
    }
    if (original.priceMin === original.priceMax) {
      return <span className="text-white font-mono">${original.priceMin.toFixed(2)}</span>
    }
    return (
      <span className="text-white font-mono">
        ${original.priceMin.toFixed(2)} – ${original.priceMax.toFixed(2)}
      </span>
    )
  })()

  // Suggestions for category autocomplete
  const catSuggestions =
    catInput.length > 0
      ? allCategories.filter(
          (c) => c.toLowerCase().includes(catInput.toLowerCase()) && !categories.includes(c)
        )
      : []

  return (
    <div
      className={`bg-zinc-900 rounded-lg border ${
        dirty ? "border-orange-500/50" : "border-zinc-800"
      } p-4 transition-colors`}
    >
      <div className="flex items-start gap-4">
        {/* Thumbnail */}
        <div className="w-16 h-16 bg-zinc-800 rounded-lg overflow-hidden flex-shrink-0">
          {original.primaryImage ? (
            <Image
              src={original.primaryImage}
              alt={original.title}
              width={64}
              height={64}
              className="w-full h-full object-cover"
            />
          ) : (
            <div className="w-full h-full flex items-center justify-center">
              <Package className="w-6 h-6 text-zinc-600" />
            </div>
          )}
        </div>

        {/* Main editable fields */}
        <div className="flex-1 min-w-0 space-y-3">
          {/* Row 1: Title + Status + Actions */}
          <div className="flex items-center gap-3">
            <input
              type="text"
              value={edited.title}
              onChange={(e) => onFieldChange("title", e.target.value)}
              className="flex-1 min-w-0 px-3 py-1.5 text-sm font-medium bg-zinc-800 border border-zinc-700 rounded text-white focus:outline-none focus:border-orange-500"
              placeholder="Product title"
            />
            <select
              value={edited.status}
              onChange={(e) => onFieldChange("status", e.target.value)}
              className={`w-28 px-2 py-1.5 text-xs rounded border focus:outline-none focus:border-orange-500 ${
                edited.status === "Active"
                  ? "bg-green-900/30 border-green-800 text-green-400"
                  : edited.status === "Draft"
                  ? "bg-yellow-900/30 border-yellow-800 text-yellow-400"
                  : "bg-zinc-800 border-zinc-700 text-zinc-400"
              }`}
            >
              <option value="Active">Active</option>
              <option value="Draft">Draft</option>
              <option value="Archived">Archived</option>
            </select>
            <Link
              href={`/admin/products/${original.id}`}
              className="p-1.5 text-zinc-500 hover:text-orange-500 hover:bg-zinc-800 rounded transition-colors"
              title="Full editor (variants + images)"
            >
              <ExternalLink className="w-4 h-4" />
            </Link>
            <Link
              href={`/shop/${original.id}`}
              target="_blank"
              className="p-1.5 text-zinc-500 hover:text-white hover:bg-zinc-800 rounded transition-colors"
              title="View on site"
            >
              <Eye className="w-4 h-4" />
            </Link>
          </div>

          {/* Row 2: Description */}
          <textarea
            value={edited.description || ""}
            onChange={(e) => onFieldChange("description", e.target.value)}
            rows={2}
            placeholder="Product description..."
            className="w-full px-3 py-1.5 text-sm bg-zinc-800 border border-zinc-700 rounded text-zinc-300 focus:outline-none focus:border-orange-500 resize-y"
          />

          {/* Row 3: Categories (tags), price, meta */}
          <div className="flex flex-wrap items-center gap-3 text-sm">
            {/* Category tags */}
            <div className="flex flex-wrap items-center gap-1.5 flex-1 min-w-[200px]">
              {categories.map((cat) => (
                <span
                  key={cat}
                  className="inline-flex items-center gap-1 px-2 py-0.5 bg-orange-900/30 text-orange-400 text-xs rounded-full border border-orange-800/50"
                >
                  {cat}
                  <button
                    onClick={() => removeCategory(cat)}
                    className="hover:text-white transition-colors"
                    type="button"
                  >
                    <X className="w-3 h-3" />
                  </button>
                </span>
              ))}
              <div className="relative">
                <input
                  ref={catInputRef}
                  type="text"
                  value={catInput}
                  onChange={(e) => setCatInput(e.target.value)}
                  onKeyDown={handleCatKeyDown}
                  onBlur={() => {
                    // Small delay so click on suggestion can fire first
                    setTimeout(() => setCatInput(""), 150)
                  }}
                  placeholder={categories.length === 0 ? "Add categories..." : "+"}
                  className="w-28 px-2 py-0.5 text-xs bg-zinc-800 border border-zinc-700 rounded text-white focus:outline-none focus:border-orange-500 placeholder:text-zinc-600"
                />
                {catSuggestions.length > 0 && (
                  <div className="absolute top-full left-0 mt-1 z-20 w-48 bg-zinc-800 border border-zinc-700 rounded-lg shadow-lg max-h-32 overflow-y-auto">
                    {catSuggestions.slice(0, 8).map((s) => (
                      <button
                        key={s}
                        type="button"
                        onMouseDown={(e) => e.preventDefault()}
                        onClick={() => {
                          addCategory(s)
                          catInputRef.current?.focus()
                        }}
                        className="w-full text-left px-3 py-1.5 text-xs text-zinc-300 hover:bg-zinc-700 hover:text-white transition-colors"
                      >
                        {s}
                      </button>
                    ))}
                  </div>
                )}
              </div>
            </div>

            {/* Price */}
            <div className="text-xs text-zinc-400">
              {priceDisplay}
              <span className="ml-1 text-zinc-600">
                ({original.variantCount} variant{original.variantCount !== 1 ? "s" : ""})
              </span>
            </div>

            {/* SKU */}
            <code className="text-[10px] text-zinc-500 bg-zinc-800 px-1.5 py-0.5 rounded">
              {original.sku}
            </code>
          </div>
        </div>
      </div>

      {/* Save / Discard bar */}
      {dirty && (
        <div className="mt-3 pt-3 border-t border-zinc-800 flex items-center justify-end gap-2">
          <button
            onClick={onDiscard}
            disabled={saving}
            className="px-3 py-1.5 text-xs text-zinc-400 hover:text-white border border-zinc-700 rounded transition-colors disabled:opacity-50"
          >
            Discard
          </button>
          <button
            onClick={onSave}
            disabled={saving}
            className="px-4 py-1.5 text-xs bg-orange-600 hover:bg-orange-500 disabled:bg-orange-800 text-white rounded transition-colors flex items-center gap-1.5"
          >
            {saving ? <Loader2 className="w-3 h-3 animate-spin" /> : <Save className="w-3 h-3" />}
            Save
          </button>
        </div>
      )}
    </div>
  )
}
