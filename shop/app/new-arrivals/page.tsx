"use client"

import Link from "next/link"
import { useEffect, useState, useMemo } from "react"
import { useCart } from "@/lib/cart-context"
import { CartDrawer } from "@/components/cart-drawer"
import { useToast } from "@/components/toast-provider"
import type { RuntimeProduct } from "@/lib/products"
import { ArrowLeft, Sparkles } from "lucide-react"
import { CategoryRow } from "@/components/category-row"
import { isProductNew } from "@/lib/categories"
import type { StorefrontSettings } from "@/lib/storefront-settings"

export default function NewArrivalsPage() {
  const { addToast } = useToast()
  const { addItem } = useCart()
  const [products, setProducts] = useState<RuntimeProduct[]>([])
  const [loading, setLoading] = useState(true)
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

  // Filter to new products, group by category
  const categoryRows = useMemo(() => {
    const newProducts = products.filter(p =>
      isProductNew(p.createdAt, settings.newArrivalsWindowDays)
    )

    // Group by category
    const grouped = new Map<string, RuntimeProduct[]>()
    for (const p of newProducts) {
      const cat = p.category || "Other"
      if (!grouped.has(cat)) grouped.set(cat, [])
      grouped.get(cat)!.push(p)
    }

    // Sort within each category by newest first
    for (const [, prods] of grouped) {
      prods.sort((a, b) => {
        const da = a.createdAt ? new Date(a.createdAt).getTime() : 0
        const db = b.createdAt ? new Date(b.createdAt).getTime() : 0
        return db - da
      })
    }

    // Sort categories by latest product
    return Array.from(grouped.entries())
      .filter(([, prods]) => prods.length > 0)
      .sort((a, b) => {
        const latestA = a[1][0]?.createdAt ? new Date(a[1][0].createdAt).getTime() : 0
        const latestB = b[1][0]?.createdAt ? new Date(b[1][0].createdAt).getTime() : 0
        return latestB - latestA
      })
  }, [products, settings.newArrivalsWindowDays])

  const totalNew = categoryRows.reduce((sum, [, prods]) => sum + prods.length, 0)

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
            <Link href="/new-arrivals" className="text-sm font-medium text-[#3D9A6C]">New</Link>
            <Link href="/clips" className="text-sm font-medium hover:text-[#3D9A6C] transition-colors">Clips</Link>
            <Link href="/account" className="text-sm font-medium hover:text-[#3D9A6C] transition-colors">Account</Link>
            <CartDrawer />
          </nav>
        </div>
      </header>

      {/* Hero */}
      <div className="bg-gradient-to-r from-emerald-900/30 to-[#0D0D0D] border-b border-[#2C2C2C]">
        <div className="container mx-auto px-4 py-10">
          <div className="flex items-center gap-3 mb-2">
            <Sparkles className="h-6 w-6 text-[#3D9A6C]" />
            <h1 className="text-3xl font-heading font-bold tracking-wide uppercase md:text-4xl text-[#F5F5F5]">
              New Arrivals
            </h1>
          </div>
          <p className="text-[#A1A1A1] font-body">
            {totalNew > 0
              ? `${totalNew} new ${totalNew === 1 ? "product" : "products"} added in the last ${settings.newArrivalsWindowDays} days`
              : "Check back soon for new gear drops!"}
          </p>
        </div>
      </div>

      {/* Main Content */}
      <main className="container mx-auto px-4 py-8">
        {loading ? (
          <div className="text-center py-12 text-[#A1A1A1]">
            <div className="inline-block animate-spin rounded-full h-8 w-8 border-b-2 border-[#3D9A6C]"></div>
            <p className="mt-4">Loading new arrivals...</p>
          </div>
        ) : totalNew === 0 ? (
          <div className="text-center py-16">
            <Sparkles className="h-12 w-12 mx-auto text-[#2C2C2C] mb-4" />
            <p className="text-[#A1A1A1] font-body text-lg">Check back soon for new arrivals!</p>
            <Link href="/shop" className="mt-4 inline-block text-sm text-[#3D9A6C] hover:underline">
              Browse all products
            </Link>
          </div>
        ) : (
          <div className="space-y-10">
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
          </div>
        )}
      </main>
    </div>
  )
}
