"use client"

import Link from "next/link"
import Image from "next/image"
import { useEffect, useState, useMemo, use } from "react"
import { useCart } from "@/lib/cart-context"
import { CartDrawer } from "@/components/cart-drawer"
import { useToast } from "@/components/toast-provider"
import type { RuntimeProduct } from "@/lib/products"
import { ArrowLeft, ShoppingCart, Search, X } from "lucide-react"
import { QuickViewButton } from "@/components/quick-view-modal"
import { WishlistButton } from "@/components/wishlist-button"
import { NewBadge } from "@/components/new-badge"
import { SortDropdown, type SortOption } from "@/components/sort-dropdown"
import { categoryFromSlug, getCategoryColor } from "@/lib/categories"
import type { StorefrontSettings } from "@/lib/storefront-settings"

export default function CategoryPage({ params }: { params: Promise<{ slug: string }> }) {
  const { slug } = use(params)
  const { addToast } = useToast()
  const { addItem } = useCart()
  const [products, setProducts] = useState<RuntimeProduct[]>([])
  const [loading, setLoading] = useState(true)
  const [searchQuery, setSearchQuery] = useState("")
  const [sortBy, setSortBy] = useState<SortOption>("newest")
  const [settings, setSettings] = useState<StorefrontSettings>({
    newArrivalsWindowDays: 30,
    categoryDisplayOrder: [],
    rowSize: 6,
  })

  useEffect(() => {
    fetch('/api/storefront-settings')
      .then(res => res.json())
      .then(data => setSettings(data))
      .catch(() => {})

    fetch('/api/products')
      .then(res => res.json())
      .then(data => {
        setProducts(data)
        setLoading(false)
      })
      .catch(err => {
        console.error('Failed to fetch products:', err)
        setLoading(false)
      })
  }, [])

  // Resolve category name from slug
  const allCategoryNames = useMemo(() => {
    const cats = new Set<string>()
    for (const p of products) {
      if (p.category) cats.add(p.category)
    }
    return Array.from(cats)
  }, [products])

  const categoryName = categoryFromSlug(slug, allCategoryNames)
  const colors = getCategoryColor(categoryName || slug)

  // Filter products for this category
  const categoryProducts = useMemo(() => {
    if (!categoryName) return []
    return products.filter(p => p.category === categoryName)
  }, [products, categoryName])

  // Apply search
  const searchedProducts = useMemo(() => {
    const q = searchQuery.trim().toLowerCase()
    if (!q) return categoryProducts
    return categoryProducts.filter(p => {
      const titleMatch = p.title.toLowerCase().includes(q)
      const variantMatch = p.variants?.some(v => v.variantName.toLowerCase().includes(q))
      return titleMatch || variantMatch
    })
  }, [categoryProducts, searchQuery])

  // Apply sorting
  const sortedProducts = useMemo(() => {
    const list = [...searchedProducts]
    switch (sortBy) {
      case "newest":
        return list.sort((a, b) => {
          const da = a.createdAt ? new Date(a.createdAt).getTime() : 0
          const db = b.createdAt ? new Date(b.createdAt).getTime() : 0
          return db - da
        })
      case "alpha-asc":
        return list.sort((a, b) => a.title.localeCompare(b.title))
      case "price-asc":
        return list.sort((a, b) => getMinPrice(a) - getMinPrice(b))
      case "price-desc":
        return list.sort((a, b) => getMinPrice(b) - getMinPrice(a))
      default:
        return list
    }
  }, [searchedProducts, sortBy])

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
            <ArrowLeft className="h-5 w-5" />
            <span className="text-lg font-heading font-bold tracking-wide uppercase">Shop</span>
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

      {/* Category Hero Header */}
      <div className={`bg-gradient-to-r ${colors.gradient} border-b border-[#2C2C2C]`}>
        <div className="container mx-auto px-4 py-10">
          <div className="inline-block">
            <h1 className="text-3xl font-heading font-bold tracking-wide uppercase md:text-4xl text-[#F5F5F5] relative">
              {categoryName || slug}
              <div className="absolute -bottom-2 left-0 w-1/3 h-1 rounded-full" style={{ backgroundColor: colors.accent }}></div>
            </h1>
          </div>
          <p className="text-[#A1A1A1] font-body mt-3">
            {categoryProducts.length} {categoryProducts.length === 1 ? "product" : "products"}
          </p>
        </div>
      </div>

      {/* Main Content */}
      <main className="container mx-auto px-4 py-8">
        {loading ? (
          <div className="text-center py-12 text-[#A1A1A1]">
            <div className="inline-block animate-spin rounded-full h-8 w-8 border-b-2 border-[#3D9A6C]"></div>
            <p className="mt-4">Loading products...</p>
          </div>
        ) : !categoryName ? (
          <div className="text-center py-12">
            <p className="text-[#A1A1A1] font-body text-lg">No products in this category.</p>
            <Link href="/shop" className="mt-4 inline-block text-sm text-[#3D9A6C] hover:underline">
              Back to Shop
            </Link>
          </div>
        ) : (
          <>
            {/* Search + Sort Bar */}
            <div className="flex flex-col sm:flex-row gap-4 mb-6 items-start sm:items-center justify-between">
              <div className="relative max-w-sm w-full sm:w-auto">
                <Search className="absolute left-3 top-1/2 -translate-y-1/2 h-4 w-4 text-[#A1A1A1] pointer-events-none" />
                <input
                  type="text"
                  value={searchQuery}
                  onChange={(e) => setSearchQuery(e.target.value)}
                  placeholder={`Search in ${categoryName}...`}
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
              <SortDropdown value={sortBy} onChange={setSortBy} />
            </div>

            {searchQuery && (
              <p className="text-xs text-[#A1A1A1] mb-4">
                {sortedProducts.length} {sortedProducts.length === 1 ? 'product' : 'products'} found matching &ldquo;{searchQuery}&rdquo;
              </p>
            )}

            {/* Product Grid */}
            <div className="grid gap-6 sm:grid-cols-2 lg:grid-cols-3 xl:grid-cols-4">
              {sortedProducts.map((product) => (
                <div key={product.id} className="group bg-[#1E1E1E] border-2 border-[#2C2C2C] rounded-2xl overflow-hidden hover:border-[#3D9A6C] hover:shadow-card transition-all hover:scale-[1.02]">
                  <Link href={`/shop/${product.id}`} className="block relative">
                    <div className="aspect-square relative bg-[#0D0D0D] overflow-hidden">
                      <Image
                        src={product.primaryImage || product.images?.[0] || '/images/placeholder.png'}
                        alt={product.title}
                        fill
                        className="object-cover group-hover:scale-105 transition-transform duration-300"
                        sizes="(max-width: 768px) 100vw, (max-width: 1200px) 50vw, 33vw"
                      />
                      <NewBadge createdAt={product.createdAt} windowDays={settings.newArrivalsWindowDays} />
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
                    <div className="flex items-center justify-between pt-2 border-t border-[#2C2C2C]">
                      <span className="text-2xl font-bold text-[#3D9A6C] font-mono">
                        ${getMinPriceStr(product)}
                      </span>
                      <span className="text-xs text-[#A1A1A1] font-mono uppercase">CAD</span>
                    </div>
                    <button
                      onClick={() => handleAddToCart(product)}
                      className="w-full py-2.5 px-4 bg-[#3D9A6C] text-black hover:bg-[#3D9A6C]-hover rounded-2xl font-medium font-heading uppercase tracking-wide transition-all flex items-center justify-center gap-2 hover:gap-3 hover:shadow-glow"
                    >
                      <ShoppingCart className="h-4 w-4" />
                      Add to Cart
                    </button>
                  </div>
                </div>
              ))}
            </div>

            {sortedProducts.length === 0 && (
              <div className="text-center py-12">
                <p className="text-[#A1A1A1] font-body">
                  {searchQuery ? 'No products match your search.' : 'No products in this category.'}
                </p>
                {searchQuery && (
                  <button onClick={() => setSearchQuery("")} className="mt-4 text-sm text-[#3D9A6C] hover:underline">
                    Clear search
                  </button>
                )}
              </div>
            )}
          </>
        )}
      </main>
    </div>
  )
}

function getMinPrice(product: RuntimeProduct): number {
  if (!product.variants || product.variants.length === 0) return 0
  return product.variants.reduce((min, v) => {
    const p = v.price_cad || 0
    return p < min ? p : min
  }, Number.POSITIVE_INFINITY)
}

function getMinPriceStr(product: RuntimeProduct): string {
  const price = getMinPrice(product)
  return price === Infinity ? "0.00" : price.toFixed(2)
}
