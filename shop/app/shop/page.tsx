"use client"

import Link from "next/link"
import { useEffect, useState, useMemo } from "react"
import { useCart } from "@/lib/cart-context"
import { CartDrawer } from "@/components/cart-drawer"
import { useToast } from "@/components/toast-provider"
import type { RuntimeProduct } from "@/lib/products"
import Image from "next/image"
import { ShoppingCart, Search, X } from "lucide-react"
import { QuickViewButton } from "@/components/quick-view-modal"
import { WishlistButton } from "@/components/wishlist-button"
import { CategoryRow } from "@/components/category-row"
import { NewBadge } from "@/components/new-badge"
import { isProductNew, slugifyCategory } from "@/lib/categories"
import type { StorefrontSettings } from "@/lib/storefront-settings"

const PRODUCTS_CACHE_KEY = 'pz_products_v1'
const PRODUCTS_CACHE_TTL = 5 * 60 * 1000 // 5 minutes

function readProductsCache(): { data: RuntimeProduct[]; timestamp: number } | null {
  try {
    const raw = localStorage.getItem(PRODUCTS_CACHE_KEY)
    if (!raw) return null
    return JSON.parse(raw)
  } catch {
    return null
  }
}

function writeProductsCache(data: RuntimeProduct[]) {
  try {
    localStorage.setItem(PRODUCTS_CACHE_KEY, JSON.stringify({ data, timestamp: Date.now() }))
  } catch {
    // localStorage may be unavailable (private browsing quota exceeded etc.)
  }
}

export default function ShopPage() {
  const { addToast } = useToast()
  const { addItem } = useCart()
  const [products, setProducts] = useState<RuntimeProduct[]>([])
  const [loading, setLoading] = useState(true)
  const [searchQuery, setSearchQuery] = useState("")
  const [settings, setSettings] = useState<StorefrontSettings>({
    newArrivalsWindowDays: 30,
    categoryDisplayOrder: [],
    rowSize: 6,
  })

  const fetchProducts = async (background = false) => {
    try {
      const res = await fetch('/api/products')
      const data = await res.json()
      setProducts(data)
      writeProductsCache(data)
      if (!background) setLoading(false)
    } catch (err) {
      console.error('Failed to fetch products:', err)
      if (!background) setLoading(false)
    }
  }

  useEffect(() => {
    // Load storefront settings
    fetch('/api/storefront-settings')
      .then(res => res.json())
      .then(data => setSettings(data))
      .catch(() => {})

    // Show cached products instantly
    const cached = readProductsCache()
    if (cached && Date.now() - cached.timestamp < PRODUCTS_CACHE_TTL) {
      setProducts(cached.data)
      setLoading(false)
      fetchProducts(true)
    } else {
      fetchProducts(false)
    }

    const refreshInterval = setInterval(() => fetchProducts(true), 300000)
    return () => clearInterval(refreshInterval)
  }, [])

  // New arrivals products
  const newArrivals = useMemo(() => {
    if (settings.newArrivalsWindowDays <= 0) return []
    return products
      .filter(p => isProductNew(p.createdAt, settings.newArrivalsWindowDays))
      .sort((a, b) => {
        const da = a.createdAt ? new Date(a.createdAt).getTime() : 0
        const db = b.createdAt ? new Date(b.createdAt).getTime() : 0
        return db - da
      })
  }, [products, settings.newArrivalsWindowDays])

  // Group products by category, sorted by latest activity
  const categoryRows = useMemo(() => {
    const grouped = new Map<string, RuntimeProduct[]>()
    for (const p of products) {
      const cat = p.category || "Other"
      if (!grouped.has(cat)) grouped.set(cat, [])
      grouped.get(cat)!.push(p)
    }

    // Sort categories: admin order first, then by latest created product
    const entries = Array.from(grouped.entries()).filter(([, prods]) => prods.length > 0)

    entries.sort((a, b) => {
      const orderA = settings.categoryDisplayOrder.indexOf(slugifyCategory(a[0]))
      const orderB = settings.categoryDisplayOrder.indexOf(slugifyCategory(b[0]))

      // Admin-ordered categories first
      if (orderA !== -1 && orderB !== -1) return orderA - orderB
      if (orderA !== -1) return -1
      if (orderB !== -1) return 1

      // Then by latest product created date (newest category first)
      const latestA = a[1].reduce((max, p) => {
        const t = p.createdAt ? new Date(p.createdAt).getTime() : 0
        return t > max ? t : max
      }, 0)
      const latestB = b[1].reduce((max, p) => {
        const t = p.createdAt ? new Date(p.createdAt).getTime() : 0
        return t > max ? t : max
      }, 0)
      return latestB - latestA
    })

    return entries
  }, [products, settings.categoryDisplayOrder])

  // Search mode: flat results grouped by category
  const searchResults = useMemo(() => {
    const q = searchQuery.trim().toLowerCase()
    if (!q) return null
    const matched = products.filter((p) => {
      const titleMatch = p.title.toLowerCase().includes(q)
      const variantMatch = p.variants?.some(v => v.variantName.toLowerCase().includes(q))
      return titleMatch || variantMatch
    })
    // Group by category
    const grouped = new Map<string, RuntimeProduct[]>()
    for (const p of matched) {
      const cat = p.category || "Other"
      if (!grouped.has(cat)) grouped.set(cat, [])
      grouped.get(cat)!.push(p)
    }
    return { total: matched.length, groups: Array.from(grouped.entries()) }
  }, [products, searchQuery])

  const handleAddToCart = (product: RuntimeProduct) => {
    if (!product.variants || product.variants.length === 0) {
      addToast({ title: "Error", description: "This product has no variants available" })
      return
    }

    const cheapestVariant = product.variants.reduce((min, v) => {
      const minPrice = min.price_cad ?? Number.MAX_SAFE_INTEGER
      const vPrice = v.price_cad ?? Number.MAX_SAFE_INTEGER
      return vPrice < minPrice ? v : min
    }, product.variants[0])

    const variant = cheapestVariant as any
    addItem({
      productId: product.id,
      productTitle: product.title,
      productImage: product.primaryImage || product.images?.[0] || '/images/placeholder.png',
      category: product.category,
      variantId: cheapestVariant.id,
      variantTitle: cheapestVariant.variantName,
      sku: cheapestVariant.sku,
      regularPrice: cheapestVariant.price_cad || 0,
      addonPrice: variant.addonPrice ?? undefined,
      isAddonEligible: variant.isAddonEligible ?? false,
    }, false)

    addToast({
      title: "Added to cart!",
      description: `${product.title} - ${cheapestVariant.variantName}`,
      action: (
        <Link href="/cart" className="text-sm font-medium text-primary hover:underline">
          View Cart
        </Link>
      )
    })
  }

  return (
    <div className="min-h-screen bg-[#0D0D0D]">
      {/* Header */}
      <header className="sticky top-0 z-50 border-b border-[#2C2C2C] bg-[#1E1E1E]/95 backdrop-blur">
        <div className="container mx-auto flex h-16 items-center justify-between px-4">
          <Link href="/shop" className="flex items-center gap-3 hover:opacity-80 transition-opacity">
            <img src="/logos/logo-icon.png" alt="Protocol Zero" className="h-10 w-auto" />
            <span className="text-xl font-heading font-bold tracking-wide uppercase">Protocol Zero</span>
          </Link>
          <nav className="flex gap-6 items-center">
            <Link href="/shop" className="text-sm font-medium hover:text-[#3D9A6C] transition-colors">Shop</Link>
            <Link href="/new-arrivals" className="text-sm font-medium hover:text-[#3D9A6C] transition-colors">New</Link>
            <Link href="/clips" className="text-sm font-medium hover:text-[#3D9A6C] transition-colors">Clips</Link>
            <Link href="/account" className="text-sm font-medium hover:text-[#3D9A6C] transition-colors">Account</Link>
            <CartDrawer />
          </nav>
        </div>
      </header>

      {/* Main Content */}
      <main className="container mx-auto px-4 py-8">
        {loading ? (
          <div className="text-center py-12 text-[#A1A1A1]">
            <div className="inline-block animate-spin rounded-full h-8 w-8 border-b-2 border-[#3D9A6C]"></div>
            <p className="mt-4">Loading products...</p>
          </div>
        ) : (
          <>
            <div className="mb-8 space-y-2">
              <div className="inline-block">
                <h1 className="text-3xl font-heading font-bold tracking-wide uppercase md:text-4xl relative">
                  Airsoft Gear & Accessories
                  <div className="absolute -bottom-2 left-0 w-1/4 h-1 bg-[#3D9A6C] rounded-full"></div>
                </h1>
              </div>
              <p className="text-[#A1A1A1] font-body">Premium tactical equipment for serious players</p>
            </div>

            {/* Search Bar */}
            <div className="mb-8">
              <div className="relative max-w-md">
                <Search className="absolute left-3 top-1/2 -translate-y-1/2 h-4 w-4 text-[#A1A1A1] pointer-events-none" />
                <input
                  type="text"
                  value={searchQuery}
                  onChange={(e) => setSearchQuery(e.target.value)}
                  placeholder="Search products or variants..."
                  className="w-full pl-10 pr-10 py-2.5 bg-[#1E1E1E] border border-[#2C2C2C] rounded-xl text-sm text-[#F5F5F5] placeholder-[#A1A1A1] focus:outline-none focus:border-[#3D9A6C] transition-colors"
                />
                {searchQuery && (
                  <button
                    onClick={() => setSearchQuery("")}
                    className="absolute right-3 top-1/2 -translate-y-1/2 text-[#A1A1A1] hover:text-[#F5F5F5] transition-colors"
                    aria-label="Clear search"
                  >
                    <X className="h-4 w-4" />
                  </button>
                )}
              </div>
            </div>

            {/* Search Results Mode */}
            {searchResults ? (
              <div>
                <p className="text-sm text-[#A1A1A1] mb-6">
                  {searchResults.total} {searchResults.total === 1 ? "product" : "products"} found matching &ldquo;{searchQuery}&rdquo;
                </p>
                {searchResults.groups.length === 0 ? (
                  <div className="text-center py-12">
                    <p className="text-[#A1A1A1] font-body">No products match your search.</p>
                    <button
                      onClick={() => setSearchQuery("")}
                      className="mt-4 text-sm text-[#3D9A6C] hover:underline"
                    >
                      Clear search
                    </button>
                  </div>
                ) : (
                  <div className="space-y-8">
                    {searchResults.groups.map(([cat, prods]) => (
                      <div key={cat}>
                        <h3 className="text-lg font-heading font-bold text-[#F5F5F5] uppercase tracking-wide mb-4">{cat}</h3>
                        <div className="grid gap-6 sm:grid-cols-2 lg:grid-cols-3 xl:grid-cols-4">
                          {prods.map((product) => (
                            <SearchResultCard
                              key={product.id}
                              product={product}
                              newWindowDays={settings.newArrivalsWindowDays}
                              onAddToCart={handleAddToCart}
                            />
                          ))}
                        </div>
                      </div>
                    ))}
                  </div>
                )}
              </div>
            ) : (
              /* Browse Mode: Netflix-style category rows */
              <div className="space-y-10">
                {/* New Arrivals Row */}
                {newArrivals.length > 0 && (
                  <CategoryRow
                    categoryName="New Arrivals"
                    products={newArrivals}
                    rowSize={settings.rowSize}
                    newWindowDays={settings.newArrivalsWindowDays}
                    onAddToCart={handleAddToCart}
                    viewAllHref="/new-arrivals"
                  />
                )}

                {/* Category Rows */}
                {categoryRows.map(([cat, prods]) => (
                  <CategoryRow
                    key={cat}
                    categoryName={cat}
                    products={prods}
                    rowSize={settings.rowSize}
                    newWindowDays={settings.newArrivalsWindowDays}
                    onAddToCart={handleAddToCart}
                  />
                ))}

                {categoryRows.length === 0 && newArrivals.length === 0 && (
                  <div className="text-center py-12">
                    <p className="text-[#A1A1A1] font-body">No products available at this time.</p>
                  </div>
                )}
              </div>
            )}
          </>
        )}
      </main>
    </div>
  )
}

/** Product card used in search results (grid layout) */
function SearchResultCard({
  product,
  newWindowDays,
  onAddToCart,
}: {
  product: RuntimeProduct
  newWindowDays: number
  onAddToCart: (product: RuntimeProduct) => void
}) {
  const cheapestPrice = product.variants?.reduce((min, v) => {
    const p = v.price_cad || 0
    return p < min ? p : min
  }, Number.POSITIVE_INFINITY) || 0

  return (
    <div className="group bg-[#1E1E1E] border-2 border-[#2C2C2C] rounded-2xl overflow-hidden hover:border-[#3D9A6C] hover:shadow-card transition-all hover:scale-[1.02]">
      <Link href={`/shop/${product.id}`} className="block relative">
        <div className="aspect-square relative bg-[#0D0D0D] overflow-hidden">
          <Image
            src={product.primaryImage || product.images?.[0] || '/images/placeholder.png'}
            alt={product.title}
            fill
            className="object-cover group-hover:scale-105 transition-transform duration-300"
            sizes="(max-width: 768px) 100vw, (max-width: 1200px) 50vw, 33vw"
          />
          <NewBadge createdAt={product.createdAt} windowDays={newWindowDays} />
          <QuickViewButton productId={product.id} />
        </div>
      </Link>
      <div className="p-4 space-y-3">
        <div className="flex items-start justify-between gap-2">
          <div className="flex-1">
            <Link href={`/shop/${product.id}`} className="hover:opacity-90">
              <h3 className="font-semibold font-body text-lg line-clamp-2 text-[#F5F5F5] group-hover:text-[#3D9A6C] transition-colors">{product.title}</h3>
            </Link>
            {product.variants && product.variants.length > 1 && (
              <p className="text-xs text-[#3D9A6C] font-semibold mt-1">Multiple variants available</p>
            )}
          </div>
          <WishlistButton productId={product.id} productTitle={product.title} className="flex-shrink-0" />
        </div>
        {product.category && (
          <span className="inline-block text-xs px-3 py-1 bg-[#3D9A6C]/10 text-[#3D9A6C] rounded-full font-medium font-heading uppercase tracking-wide">
            {product.category}
          </span>
        )}
        <div className="flex items-center justify-between pt-2 border-t border-[#2C2C2C]">
          <span className="text-2xl font-bold text-[#3D9A6C] font-mono">
            ${cheapestPrice === Infinity ? "0.00" : cheapestPrice.toFixed(2)}
          </span>
          <span className="text-xs text-[#A1A1A1] font-mono uppercase">CAD</span>
        </div>
        <button
          onClick={() => onAddToCart(product)}
          className="w-full py-2.5 px-4 bg-[#3D9A6C] text-black hover:bg-[#3D9A6C]-hover rounded-2xl font-medium font-heading uppercase tracking-wide transition-all flex items-center justify-center gap-2 hover:gap-3 hover:shadow-glow"
        >
          <ShoppingCart className="h-4 w-4" />
          Add to Cart
        </button>
      </div>
    </div>
  )
}
