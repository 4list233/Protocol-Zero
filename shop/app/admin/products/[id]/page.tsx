"use client"

import { useEffect, useState } from "react"
import { useParams, useRouter } from "next/navigation"
import Link from "next/link"
import Image from "next/image"
import {
  ChevronLeft,
  Save,
  Eye,
  Package,
  AlertCircle,
  Check,
  Loader2,
  GripVertical,
} from "lucide-react"
import {
  getAdminCategories,
  saveCustomCategory,
} from "@/lib/admin-categories"
import { useAdminFetch } from "@/hooks/use-admin-fetch"

type Variant = {
  id: string
  sku: string
  variantName: string
  priceCny: number
  priceCad: number
  costCad: number
  marginStandard: number
  marginPromo: number
  optionType1: string
  optionValue1: string
  optionType2: string | null
  optionValue2: string | null
  stock: number
  status: string
  sortOrder: number
  variantImage?: string
}

type Product = {
  id: string
  knackId: string
  sku: string
  title: string
  titleOriginal: string
  description: string
  category: string
  status: string
  priceCadBase: number
  url: string
  primaryImage: string
  images: string[]
  detailImage: string
  variants: Variant[]
}

const OPTION_TYPES = ["Color", "Size", "Style", "Material", "Length", "Width"]

export default function ProductEditorPage() {
  const params = useParams()
  const router = useRouter()
  const productId = params.id as string

  const [product, setProduct] = useState<Product | null>(null)
  const [loading, setLoading] = useState(true)
  const [saving, setSaving] = useState(false)
  const [error, setError] = useState<string | null>(null)
  const [success, setSuccess] = useState<string | null>(null)
  const [activeTab, setActiveTab] = useState<"details" | "variants" | "images">("details")
  const [adminCategories, setAdminCategories] = useState<string[]>([])
  const adminFetch = useAdminFetch()

  // Load categories after mount (localStorage is client-only)
  useEffect(() => {
    setAdminCategories(getAdminCategories())
  }, [])

  useEffect(() => {
    async function fetchProduct() {
      try {
        const res = await adminFetch(`/api/admin/products/${productId}`)
        if (!res.ok) throw new Error("Product not found")
        const data = await res.json()
        setProduct(data)
      } catch (err) {
        setError("Failed to load product")
        console.error(err)
      } finally {
        setLoading(false)
      }
    }

    if (productId) {
      fetchProduct()
    }
  }, [productId, adminFetch])

  const handleProductChange = (field: keyof Product, value: unknown) => {
    if (!product) return
    setProduct({ ...product, [field]: value })
  }

  const handleVariantChange = (variantId: string, field: keyof Variant, value: unknown) => {
    if (!product) return
    setProduct({
      ...product,
      variants: product.variants.map((v) =>
        v.id === variantId ? { ...v, [field]: value } : v
      ),
    })
  }

  const handleSave = async () => {
    if (!product) return

    setSaving(true)
    setError(null)
    setSuccess(null)

    try {
      const res = await adminFetch(`/api/admin/products/${productId}`, {
        method: "PUT",
        body: JSON.stringify(product),
      })

      if (!res.ok) {
        const data = await res.json()
        throw new Error(data.error || "Failed to save")
      }

      // Save each variant
      if (product.variants.length > 0) {
        const variantSaves = product.variants.map((v) =>
          adminFetch(`/api/admin/variants/${v.id}`, {
            method: "PUT",
            body: JSON.stringify({
              variantName: v.variantName,
              priceCad: v.priceCad,
              priceCny: v.priceCny,
              costCad: v.costCad,
              stock: v.stock,
              status: v.status,
              optionType1: v.optionType1,
              optionValue1: v.optionValue1,
              optionType2: v.optionType2,
              optionValue2: v.optionValue2,
              marginStandard: v.marginStandard,
              marginPromo: v.marginPromo,
            }),
          })
        )
        const variantResults = await Promise.all(variantSaves)
        const failedCount = variantResults.filter((r) => !r.ok).length
        if (failedCount > 0) {
          throw new Error(`${failedCount} variant(s) failed to save`)
        }
      }

      // Persist any newly typed category so it appears in future dropdowns
      if (product.category) {
        saveCustomCategory(product.category)
        setAdminCategories(getAdminCategories())
      }

      // Refresh product data from server so textarea reflects saved state
      const refreshRes = await adminFetch(`/api/admin/products/${productId}`)
      if (refreshRes.ok) {
        const refreshed = await refreshRes.json()
        setProduct(refreshed)
      }

      setSuccess("Product saved successfully!")
      setTimeout(() => setSuccess(null), 3000)
    } catch (err) {
      setError(err instanceof Error ? err.message : "Failed to save product")
    } finally {
      setSaving(false)
    }
  }

  if (loading) {
    return (
      <div className="flex items-center justify-center h-64">
        <div className="animate-spin rounded-full h-8 w-8 border-t-2 border-b-2 border-orange-500"></div>
      </div>
    )
  }

  if (!product) {
    return (
      <div className="text-center py-12">
        <Package className="w-12 h-12 mx-auto text-zinc-600 mb-4" />
        <h2 className="text-xl font-semibold text-white mb-2">Product Not Found</h2>
        <Link href="/admin/products" className="text-orange-500 hover:text-orange-400">
          Back to Products
        </Link>
      </div>
    )
  }

  return (
    <div className="space-y-6">
      {/* Header */}
      <div className="flex items-center justify-between">
        <div className="flex items-center gap-4">
          <Link
            href="/admin/products"
            className="p-2 text-zinc-400 hover:text-white hover:bg-zinc-800 rounded-lg transition-colors"
          >
            <ChevronLeft className="w-5 h-5" />
          </Link>
          <div>
            <h1 className="text-2xl font-bold text-white">{product.title}</h1>
            <p className="text-zinc-400 mt-1">SKU: {product.sku}</p>
          </div>
        </div>
        <div className="flex items-center gap-3">
          <Link
            href={`/shop/${product.id}`}
            target="_blank"
            className="px-4 py-2 text-zinc-400 hover:text-white border border-zinc-700 rounded-lg transition-colors flex items-center gap-2"
          >
            <Eye className="w-4 h-4" />
            View on Site
          </Link>
          <button
            onClick={handleSave}
            disabled={saving}
            className="px-4 py-2 bg-orange-600 hover:bg-orange-500 disabled:bg-orange-800 text-white rounded-lg transition-colors flex items-center gap-2"
          >
            {saving ? (
              <Loader2 className="w-4 h-4 animate-spin" />
            ) : (
              <Save className="w-4 h-4" />
            )}
            Save Changes
          </button>
        </div>
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

      {/* Tabs */}
      <div className="border-b border-zinc-800">
        <nav className="flex gap-4">
          {(["details", "variants", "images"] as const).map((tab) => (
            <button
              key={tab}
              onClick={() => setActiveTab(tab)}
              className={`px-4 py-3 text-sm font-medium border-b-2 transition-colors ${
                activeTab === tab
                  ? "border-orange-500 text-orange-500"
                  : "border-transparent text-zinc-400 hover:text-white"
              }`}
            >
              {tab.charAt(0).toUpperCase() + tab.slice(1)}
              {tab === "variants" && ` (${product.variants.length})`}
            </button>
          ))}
        </nav>
      </div>

      {/* Tab Content */}
      {activeTab === "details" && (
        <ProductDetailsTab product={product} onChange={handleProductChange} categories={adminCategories} />
      )}
      {activeTab === "variants" && (
        <VariantsTab
          variants={product.variants}
          onChange={handleVariantChange}
        />
      )}
      {activeTab === "images" && (
        <ImagesTab product={product} />
      )}
    </div>
  )
}

function ProductDetailsTab({
  product,
  onChange,
  categories,
}: {
  product: Product
  onChange: (field: keyof Product, value: unknown) => void
  categories: string[]
}) {
  return (
    <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
      {/* Basic Info */}
      <div className="bg-zinc-900 rounded-lg border border-zinc-800 p-6 space-y-4">
        <h3 className="text-lg font-semibold text-white">Basic Information</h3>

        <div>
          <label className="block text-sm text-zinc-400 mb-1">Title (English)</label>
          <input
            type="text"
            value={product.title}
            onChange={(e) => onChange("title", e.target.value)}
            className="w-full px-4 py-2 bg-zinc-800 border border-zinc-700 rounded-lg text-white focus:outline-none focus:border-orange-500"
          />
        </div>

        <div>
          <label className="block text-sm text-zinc-400 mb-1">Title (Original Chinese)</label>
          <input
            type="text"
            value={product.titleOriginal || ""}
            onChange={(e) => onChange("titleOriginal", e.target.value)}
            className="w-full px-4 py-2 bg-zinc-800 border border-zinc-700 rounded-lg text-white focus:outline-none focus:border-orange-500"
          />
        </div>

        <div>
          <label className="block text-sm text-zinc-400 mb-1">Description</label>
          <textarea
            value={product.description || ""}
            onChange={(e) => onChange("description", e.target.value)}
            rows={6}
            placeholder="Enter product description. Press Enter twice for a new paragraph."
            className="w-full px-4 py-2 bg-zinc-800 border border-zinc-700 rounded-lg text-white focus:outline-none focus:border-orange-500 resize-y"
          />
        </div>

        <div className="grid grid-cols-2 gap-4">
          <div>
            <label className="block text-sm text-zinc-400 mb-1">Category</label>
            <input
              type="text"
              list="admin-category-options"
              value={product.category || ""}
              onChange={(e) => onChange("category", e.target.value)}
              placeholder="Select or type a category..."
              className="w-full px-4 py-2 bg-zinc-800 border border-zinc-700 rounded-lg text-white focus:outline-none focus:border-orange-500 placeholder-zinc-600"
            />
            <datalist id="admin-category-options">
              {categories.map((cat) => (
                <option key={cat} value={cat} />
              ))}
            </datalist>
            <p className="text-xs text-zinc-600 mt-1">
              Pick from the list or type a new one — new categories are saved on Save.
            </p>
          </div>

          <div>
            <label className="block text-sm text-zinc-400 mb-1">Status</label>
            <select
              value={product.status}
              onChange={(e) => onChange("status", e.target.value)}
              className="w-full px-4 py-2 bg-zinc-800 border border-zinc-700 rounded-lg text-white focus:outline-none focus:border-orange-500"
            >
              <option value="Active">Active</option>
              <option value="Draft">Draft</option>
              <option value="Archived">Archived</option>
            </select>
          </div>
        </div>
      </div>

      {/* Pricing */}
      <div className="bg-zinc-900 rounded-lg border border-zinc-800 p-6 space-y-4">
        <h3 className="text-lg font-semibold text-white">Pricing</h3>

        <div>
          <label className="block text-sm text-zinc-400 mb-1">Selling Price (CAD)</label>
          <div className="px-4 py-2 bg-zinc-800/50 border border-zinc-700/50 rounded-lg text-zinc-300">
            {(() => {
              const prices = product.variants.map((v) => v.priceCad).filter((p) => p > 0)
              if (prices.length === 0) return <span className="text-zinc-500">No variants with price</span>
              const min = Math.min(...prices)
              const max = Math.max(...prices)
              return min === max
                ? `$${min.toFixed(2)} CAD`
                : `From $${min.toFixed(2)} – $${max.toFixed(2)} CAD`
            })()}
          </div>
          <p className="text-xs text-zinc-500 mt-1">
            Pricing is set per variant. Edit prices in the Variants tab.
          </p>
        </div>

        <div>
          <label className="block text-sm text-zinc-400 mb-1">SKU</label>
          <input
            type="text"
            value={product.sku}
            onChange={(e) => onChange("sku", e.target.value)}
            className="w-full px-4 py-2 bg-zinc-800 border border-zinc-700 rounded-lg text-white focus:outline-none focus:border-orange-500"
          />
        </div>

        <div>
          <label className="block text-sm text-zinc-400 mb-1">Source URL (Taobao)</label>
          <input
            type="url"
            value={product.url || ""}
            onChange={(e) => onChange("url", e.target.value)}
            className="w-full px-4 py-2 bg-zinc-800 border border-zinc-700 rounded-lg text-white focus:outline-none focus:border-orange-500"
          />
        </div>
      </div>
    </div>
  )
}

function VariantsTab({
  variants,
  onChange,
}: {
  variants: Variant[]
  onChange: (variantId: string, field: keyof Variant, value: unknown) => void
}) {
  const sortedVariants = [...variants].sort((a, b) => a.sortOrder - b.sortOrder)

  return (
    <div className="space-y-4">
      {sortedVariants.map((variant, index) => (
        <div
          key={variant.id}
          className="bg-zinc-900 rounded-lg border border-zinc-800 p-4"
        >
          <div className="flex items-start gap-4">
            {/* Drag Handle */}
            <div className="pt-2 text-zinc-600 cursor-move">
              <GripVertical className="w-5 h-5" />
            </div>

            {/* Variant Image */}
            <div className="w-16 h-16 bg-zinc-800 rounded-lg overflow-hidden flex-shrink-0">
              {variant.variantImage ? (
                <Image
                  src={variant.variantImage}
                  alt={variant.variantName}
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

            {/* Variant Fields */}
            <div className="flex-1 grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-4">
              <div>
                <label className="block text-xs text-zinc-500 mb-1">Variant Name</label>
                <input
                  type="text"
                  value={variant.variantName}
                  onChange={(e) => onChange(variant.id, "variantName", e.target.value)}
                  className="w-full px-3 py-1.5 text-sm bg-zinc-800 border border-zinc-700 rounded text-white focus:outline-none focus:border-orange-500"
                />
              </div>

              <div>
                <label className="block text-xs text-zinc-500 mb-1">Option Type 1</label>
                <select
                  value={variant.optionType1 || ""}
                  onChange={(e) => onChange(variant.id, "optionType1", e.target.value)}
                  className="w-full px-3 py-1.5 text-sm bg-zinc-800 border border-zinc-700 rounded text-white focus:outline-none focus:border-orange-500"
                >
                  <option value="">Select</option>
                  {OPTION_TYPES.map((type) => (
                    <option key={type} value={type}>
                      {type}
                    </option>
                  ))}
                </select>
              </div>

              <div>
                <label className="block text-xs text-zinc-500 mb-1">Option Value 1</label>
                <input
                  type="text"
                  value={variant.optionValue1 || ""}
                  onChange={(e) => onChange(variant.id, "optionValue1", e.target.value)}
                  className="w-full px-3 py-1.5 text-sm bg-zinc-800 border border-zinc-700 rounded text-white focus:outline-none focus:border-orange-500"
                />
              </div>

              <div>
                <label className="block text-xs text-zinc-500 mb-1">Option Type 2</label>
                <select
                  value={variant.optionType2 || ""}
                  onChange={(e) => onChange(variant.id, "optionType2", e.target.value || null)}
                  className="w-full px-3 py-1.5 text-sm bg-zinc-800 border border-zinc-700 rounded text-white focus:outline-none focus:border-orange-500"
                >
                  <option value="">None</option>
                  {OPTION_TYPES.map((type) => (
                    <option key={type} value={type}>
                      {type}
                    </option>
                  ))}
                </select>
              </div>

              <div>
                <label className="block text-xs text-zinc-500 mb-1">Option Value 2</label>
                <input
                  type="text"
                  value={variant.optionValue2 || ""}
                  onChange={(e) => onChange(variant.id, "optionValue2", e.target.value || null)}
                  className="w-full px-3 py-1.5 text-sm bg-zinc-800 border border-zinc-700 rounded text-white focus:outline-none focus:border-orange-500"
                />
              </div>

              <div>
                <label className="block text-xs text-zinc-500 mb-1">Price CNY</label>
                <input
                  type="number"
                  step="0.01"
                  value={variant.priceCny || 0}
                  onChange={(e) => onChange(variant.id, "priceCny", parseFloat(e.target.value) || 0)}
                  className="w-full px-3 py-1.5 text-sm bg-zinc-800 border border-zinc-700 rounded text-white focus:outline-none focus:border-orange-500"
                />
              </div>

              <div>
                <label className="block text-xs text-zinc-500 mb-1">Price CAD</label>
                <input
                  type="number"
                  step="0.01"
                  value={variant.priceCad || 0}
                  onChange={(e) => onChange(variant.id, "priceCad", parseFloat(e.target.value) || 0)}
                  className="w-full px-3 py-1.5 text-sm bg-zinc-800 border border-zinc-700 rounded text-white focus:outline-none focus:border-orange-500"
                />
              </div>

              <div>
                <label className="block text-xs text-zinc-500 mb-1">Status</label>
                <select
                  value={variant.status}
                  onChange={(e) => onChange(variant.id, "status", e.target.value)}
                  className="w-full px-3 py-1.5 text-sm bg-zinc-800 border border-zinc-700 rounded text-white focus:outline-none focus:border-orange-500"
                >
                  <option value="Active">Active</option>
                  <option value="Archived">Archived</option>
                </select>
              </div>
            </div>
          </div>

          {/* SKU and Margin info */}
          <div className="mt-3 pt-3 border-t border-zinc-800 flex items-center justify-between text-xs text-zinc-500">
            <span>SKU: {variant.sku}</span>
            <span>
              Margin: {variant.marginStandard?.toFixed(1) ?? "0"}% standard /{" "}
              {variant.marginPromo?.toFixed(1) ?? "0"}% promo
            </span>
          </div>
        </div>
      ))}

      {variants.length === 0 && (
        <div className="bg-zinc-900 rounded-lg border border-zinc-800 p-12 text-center">
          <Package className="w-12 h-12 mx-auto text-zinc-600 mb-4" />
          <p className="text-zinc-400">No variants for this product</p>
        </div>
      )}
    </div>
  )
}

function ImagesTab({
  product,
}: {
  product: Product
}) {
  return (
    <div className="space-y-6">
      <div className="bg-amber-900/20 border border-amber-800/50 rounded-lg p-4">
        <p className="text-sm text-amber-400">
          Images are managed via the scraper pipeline. Run{" "}
          <code className="bg-zinc-800 px-1 rounded">upload_to_knack.py --with-images</code>{" "}
          after scraping to update product images.
        </p>
      </div>

      {/* Primary Image */}
      <div className="bg-zinc-900 rounded-lg border border-zinc-800 p-6">
        <h3 className="text-lg font-semibold text-white mb-4">Primary Image</h3>
        <div className="flex items-start gap-6">
          <div className="w-48 h-48 bg-zinc-800 rounded-lg overflow-hidden flex-shrink-0">
            {product.primaryImage ? (
              <Image
                src={product.primaryImage}
                alt={product.title}
                width={192}
                height={192}
                className="w-full h-full object-cover"
              />
            ) : (
              <div className="w-full h-full flex items-center justify-center">
                <Package className="w-12 h-12 text-zinc-600" />
              </div>
            )}
          </div>
          {!product.primaryImage && (
            <p className="text-sm text-zinc-500 self-center">No primary image uploaded yet.</p>
          )}
        </div>
      </div>

      {/* Detail Image */}
      <div className="bg-zinc-900 rounded-lg border border-zinc-800 p-6">
        <h3 className="text-lg font-semibold text-white mb-4">Detail Image (Stitched)</h3>
        <div className="flex items-start gap-6">
          <div className="w-48 h-48 bg-zinc-800 rounded-lg overflow-hidden flex-shrink-0">
            {product.detailImage ? (
              <Image
                src={product.detailImage}
                alt="Detail"
                width={192}
                height={192}
                className="w-full h-full object-cover"
              />
            ) : (
              <div className="w-full h-full flex items-center justify-center">
                <Package className="w-12 h-12 text-zinc-600" />
              </div>
            )}
          </div>
          {!product.detailImage && (
            <p className="text-sm text-zinc-500 self-center">
              No detail image. Run{" "}
              <code className="bg-zinc-800 px-1 rounded text-xs">stitch_details.py</code>{" "}
              then re-upload.
            </p>
          )}
        </div>
      </div>

      {/* Gallery Images */}
      <div className="bg-zinc-900 rounded-lg border border-zinc-800 p-6">
        <div className="flex items-center justify-between mb-4">
          <h3 className="text-lg font-semibold text-white">Gallery Images</h3>
          <span className="text-sm text-zinc-500">{(product.images || []).length} image(s)</span>
        </div>
        {(product.images || []).length > 0 ? (
          <div className="grid grid-cols-2 md:grid-cols-4 gap-4">
            {(product.images || []).map((img, index) => (
              <div key={index} className="w-full aspect-square bg-zinc-800 rounded-lg overflow-hidden">
                <Image
                  src={img}
                  alt={`Gallery ${index + 1}`}
                  width={200}
                  height={200}
                  className="w-full h-full object-cover"
                />
              </div>
            ))}
          </div>
        ) : (
          <p className="text-sm text-zinc-500">No gallery images uploaded yet.</p>
        )}
      </div>
    </div>
  )
}
