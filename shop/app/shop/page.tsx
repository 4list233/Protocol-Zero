"use client"

import Link from "next/link"
import { useEffect, useState, useMemo } from "react"
import { useCart } from "@/lib/cart-context"
import { CartDrawer } from "@/components/cart-drawer"
import { useToast } from "@/components/toast-provider"
import type { RuntimeProduct } from "@/lib/products"
import Image from "next/image"
import { ShoppingCart, Check, Heart, Search, X } from "lucide-react"
import { QuickViewButton } from "@/components/quick-view-modal"
import { WishlistButton } from "@/components/wishlist-button"

export default function ShopPage() {
  const { addToast } = useToast()
  const { addItem, addonsUnlocked } = useCart()
  const [products, setProducts] = useState<RuntimeProduct[]>([])
  const [loading, setLoading] = useState(true)
  const [searchQuery, setSearchQuery] = useState("")
  const [selectedCategory, setSelectedCategory] = useState<string | null>(null)

  const fetchProducts = async () => {
    try {
      const res = await fetch('/api/products', {
        cache: 'no-store',
        headers: { 'Cache-Control': 'no-cache' }
      })
      const data = await res.json()
      setProducts(data)
      setLoading(false)
    } catch (err) {
      console.error('Failed to fetch products:', err)
      setLoading(false)
    }
  }

  useEffect(() => {
    fetchProducts()
    const refreshInterval = setInterval(fetchProducts, 30000)
    return () => clearInterval(refreshInterval)
  }, [])

  // Derive unique sorted categories from loaded products
  const categories = useMemo(() => {
    const cats = new Set<string>()
    for (const p of products) {
      if (p.category) cats.add(p.category)
    }
    return Array.from(cats).sort()
  }, [products])

  // Filter products by search query and/or selected category
  const filteredProducts = useMemo(() => {
    const q = searchQuery.trim().toLowerCase()
    return products.filter((p) => {
      if (selectedCategory && p.category !== selectedCategory) return false
      if (q) {
        const titleMatch = p.title.toLowerCase().includes(q)
        const variantMatch = p.variants?.some(v =>
          v.variantName.toLowerCase().includes(q)
        )
        if (!titleMatch && !variantMatch) return false
      }
      return true
    })
  }, [products, searchQuery, selectedCategory])

  const handleAddToCart = (product: RuntimeProduct) => {
    // All products should have at least 1 variant - use cheapest variant
    if (!product.variants || product.variants.length === 0) {
      addToast({
        title: "Error",
        description: "This product has no variants available",
      })
      return
    }

    // Find cheapest variant
    const cheapestVariant = product.variants.reduce((min, v) => {
      const minPrice = min.price_cad ?? Number.MAX_SAFE_INTEGER
      const vPrice = v.price_cad ?? Number.MAX_SAFE_INTEGER
      return vPrice < minPrice ? v : min
    }, product.variants[0])

    // Add to cart using new cart context
    const variant = cheapestVariant as any // Type assertion for add-on fields
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
    }, false) // Don't add as addon initially - user can toggle later

    addToast({
      title: "Added to cart!",
      description: `${product.title} - ${cheapestVariant.variantName}`,
      action: (
        <Link
          href="/cart"
          className="text-sm font-medium text-primary hover:underline"
        >
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
            <img
              src="/logos/logo-icon.png"
              alt="Protocol Zero"
              className="h-10 w-auto"
            />
            <span className="text-xl font-heading font-bold tracking-wide uppercase">Protocol Zero</span>
          </Link>
          <nav className="flex gap-6 items-center">
            <Link href="/shop" className="text-sm font-medium hover:text-[#3D9A6C] transition-colors">Shop</Link>
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

            {/* Search + Category Filters */}
            <div className="mb-6 space-y-4">
              {/* Search Bar */}
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

              {/* Category Chips */}
              {categories.length > 0 && (
                <div className="flex flex-wrap gap-2">
                  <button
                    onClick={() => setSelectedCategory(null)}
                    className={`px-4 py-1.5 rounded-full text-xs font-heading font-semibold uppercase tracking-wide transition-all ${
                      selectedCategory === null
                        ? 'bg-[#3D9A6C] text-black'
                        : 'bg-[#1E1E1E] border border-[#2C2C2C] text-[#A1A1A1] hover:border-[#3D9A6C] hover:text-[#3D9A6C]'
                    }`}
                  >
                    All
                  </button>
                  {categories.map((cat) => (
                    <button
                      key={cat}
                      onClick={() => setSelectedCategory(cat === selectedCategory ? null : cat)}
                      className={`px-4 py-1.5 rounded-full text-xs font-heading font-semibold uppercase tracking-wide transition-all ${
                        selectedCategory === cat
                          ? 'bg-[#3D9A6C] text-black'
                          : 'bg-[#1E1E1E] border border-[#2C2C2C] text-[#A1A1A1] hover:border-[#3D9A6C] hover:text-[#3D9A6C]'
                      }`}
                    >
                      {cat}
                    </button>
                  ))}
                </div>
              )}

              {/* Results count when filtering */}
              {(searchQuery || selectedCategory) && (
                <p className="text-xs text-[#A1A1A1]">
                  {filteredProducts.length} {filteredProducts.length === 1 ? 'product' : 'products'} found
                  {selectedCategory && ` in ${selectedCategory}`}
                  {searchQuery && ` matching "${searchQuery}"`}
                </p>
              )}
            </div>

            {/* Product Grid */}
            <div className="grid gap-6 sm:grid-cols-2 lg:grid-cols-3 xl:grid-cols-4">
              {filteredProducts.map((product) => (
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
                      {/* Quick View Button */}
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
                    <div>
                      {product.category && (
                        <button
                          onClick={() => setSelectedCategory(product.category === selectedCategory ? null : product.category!)}
                          className="inline-block mt-2 text-xs px-3 py-1 bg-[#3D9A6C]/10 text-[#3D9A6C] rounded-full font-medium font-heading uppercase tracking-wide hover:bg-[#3D9A6C]/20 transition-colors"
                        >
                          {product.category}
                        </button>
                      )}
                    </div>
                    <div className="flex items-center justify-between pt-2 border-t border-[#2C2C2C]">
                      <span className="text-2xl font-bold text-[#3D9A6C] font-mono">
                        ${product.variants && product.variants.length > 0
                          ? (product.variants.reduce((min, v) => {
                              const p = v.price_cad || 0
                              return p < min ? p : min
                            }, Number.POSITIVE_INFINITY) || 0).toFixed(2)
                          : '0.00'}
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

            {filteredProducts.length === 0 && (
              <div className="text-center py-12">
                <p className="text-[#A1A1A1] font-body">
                  {searchQuery || selectedCategory
                    ? 'No products match your search.'
                    : 'No products available at this time.'}
                </p>
                {(searchQuery || selectedCategory) && (
                  <button
                    onClick={() => { setSearchQuery(""); setSelectedCategory(null) }}
                    className="mt-4 text-sm text-[#3D9A6C] hover:underline"
                  >
                    Clear filters
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
