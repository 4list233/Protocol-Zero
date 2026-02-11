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
  Trash2,
  Plus,
} from "lucide-react"

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
  knackRecordId: string
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

const CATEGORIES = [
  "Vests",
  "Helmets",
  "Pouches",
  "Accessories",
  "Clothing",
  "Eyewear",
  "Gloves",
  "Footwear",
  "Communications",
  "Other",
]

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

  useEffect(() => {
    async function fetchProduct() {
      try {
        const res = await fetch(`/api/admin/products/${productId}`)
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
  }, [productId])

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
      const res = await fetch(`/api/admin/products/${productId}`, {
        method: "PUT",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify(product),
      })

      if (!res.ok) {
        const data = await res.json()
        throw new Error(data.error || "Failed to save")
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
        <ProductDetailsTab product={product} onChange={handleProductChange} />
      )}
      {activeTab === "variants" && (
        <VariantsTab
          variants={product.variants}
          onChange={handleVariantChange}
        />
      )}
      {activeTab === "images" && (
        <ImagesTab product={product} onChange={handleProductChange} />
      )}
    </div>
  )
}

function ProductDetailsTab({
  product,
  onChange,
}: {
  product: Product
  onChange: (field: keyof Product, value: unknown) => void
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
            rows={4}
            className="w-full px-4 py-2 bg-zinc-800 border border-zinc-700 rounded-lg text-white focus:outline-none focus:border-orange-500 resize-none"
          />
        </div>

        <div className="grid grid-cols-2 gap-4">
          <div>
            <label className="block text-sm text-zinc-400 mb-1">Category</label>
            <select
              value={product.category || ""}
              onChange={(e) => onChange("category", e.target.value)}
              className="w-full px-4 py-2 bg-zinc-800 border border-zinc-700 rounded-lg text-white focus:outline-none focus:border-orange-500"
            >
              <option value="">Select Category</option>
              {CATEGORIES.map((cat) => (
                <option key={cat} value={cat}>
                  {cat}
                </option>
              ))}
            </select>
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
          <label className="block text-sm text-zinc-400 mb-1">Base Price (CAD)</label>
          <div className="relative">
            <span className="absolute left-3 top-1/2 -translate-y-1/2 text-zinc-500">$</span>
            <input
              type="number"
              step="0.01"
              value={product.priceCadBase || 0}
              onChange={(e) => onChange("priceCadBase", parseFloat(e.target.value) || 0)}
              className="w-full pl-8 pr-4 py-2 bg-zinc-800 border border-zinc-700 rounded-lg text-white focus:outline-none focus:border-orange-500"
            />
          </div>
          <p className="text-xs text-zinc-500 mt-1">
            This is the base price. Variant prices may override this.
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
  onChange,
}: {
  product: Product
  onChange: (field: keyof Product, value: unknown) => void
}) {
  return (
    <div className="space-y-6">
      {/* Primary Image */}
      <div className="bg-zinc-900 rounded-lg border border-zinc-800 p-6">
        <h3 className="text-lg font-semibold text-white mb-4">Primary Image</h3>
        <div className="flex items-start gap-6">
          <div className="w-48 h-48 bg-zinc-800 rounded-lg overflow-hidden">
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
          <div className="flex-1">
            <label className="block text-sm text-zinc-400 mb-2">Image URL</label>
            <input
              type="url"
              value={product.primaryImage || ""}
              onChange={(e) => onChange("primaryImage", e.target.value)}
              className="w-full px-4 py-2 bg-zinc-800 border border-zinc-700 rounded-lg text-white focus:outline-none focus:border-orange-500"
              placeholder="https://..."
            />
            <p className="text-xs text-zinc-500 mt-2">
              This is the main image shown on product cards and as the hero image.
            </p>
          </div>
        </div>
      </div>

      {/* Detail Image */}
      <div className="bg-zinc-900 rounded-lg border border-zinc-800 p-6">
        <h3 className="text-lg font-semibold text-white mb-4">Detail Image (Stitched)</h3>
        <div className="flex items-start gap-6">
          <div className="w-48 h-48 bg-zinc-800 rounded-lg overflow-hidden">
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
          <div className="flex-1">
            <label className="block text-sm text-zinc-400 mb-2">Image URL</label>
            <input
              type="url"
              value={product.detailImage || ""}
              onChange={(e) => onChange("detailImage", e.target.value)}
              className="w-full px-4 py-2 bg-zinc-800 border border-zinc-700 rounded-lg text-white focus:outline-none focus:border-orange-500"
              placeholder="https://..."
            />
            <p className="text-xs text-zinc-500 mt-2">
              This is the stitched/composite detail image showing product features.
            </p>
          </div>
        </div>
      </div>

      {/* Gallery Images */}
      <div className="bg-zinc-900 rounded-lg border border-zinc-800 p-6">
        <h3 className="text-lg font-semibold text-white mb-4">Gallery Images</h3>
        <div className="grid grid-cols-2 md:grid-cols-4 gap-4">
          {(product.images || []).map((img, index) => (
            <div key={index} className="relative group">
              <div className="w-full aspect-square bg-zinc-800 rounded-lg overflow-hidden">
                <Image
                  src={img}
                  alt={`Gallery ${index + 1}`}
                  width={200}
                  height={200}
                  className="w-full h-full object-cover"
                />
              </div>
              <button
                onClick={() => {
                  const newImages = product.images.filter((_, i) => i !== index)
                  onChange("images", newImages)
                }}
                className="absolute top-2 right-2 p-1.5 bg-red-600 text-white rounded-lg opacity-0 group-hover:opacity-100 transition-opacity"
              >
                <Trash2 className="w-4 h-4" />
              </button>
            </div>
          ))}
          <button
            onClick={() => {
              const url = prompt("Enter image URL:")
              if (url) {
                onChange("images", [...(product.images || []), url])
              }
            }}
            className="w-full aspect-square bg-zinc-800 hover:bg-zinc-700 rounded-lg flex items-center justify-center text-zinc-500 hover:text-white transition-colors"
          >
            <Plus className="w-8 h-8" />
          </button>
        </div>
      </div>
    </div>
  )
}
