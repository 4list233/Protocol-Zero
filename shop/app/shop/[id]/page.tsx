"use client"

import { useRouter } from "next/navigation"
import { useCart } from "@/lib/cart-context"
import Image from "next/image"
import Link from "next/link"
import { useState, useEffect, use } from "react"
import type { RuntimeProduct } from "../../../lib/products"
import { CartDrawer } from "@/components/cart-drawer"
import { useToast } from "@/components/toast-provider"
import { ArrowLeft, ShoppingCart } from "lucide-react"
import MultiVariantSelector from "@/components/multi-variant-selector"

export default function ProductDetailPage({ params }: { params: Promise<{ id: string }> }) {
  const router = useRouter()
  const { addToast } = useToast()
  const { addItem, addonsUnlocked } = useCart()
  const { id } = use(params)
  const [product, setProduct] = useState<RuntimeProduct | null>(null)
  const [loading, setLoading] = useState(true)
  const [selectedVariantId, setSelectedVariantId] = useState<string | null>(null)

  useEffect(() => {
    fetch(`/api/products/${id}`)
      .then(res => res.json())
      .then(data => {
        setProduct(data)
        if (data.variants && data.variants.length > 0) {
          setSelectedVariantId(data.variants[0].id)
        }
        setLoading(false)
      })
      .catch(err => {
        console.error('Failed to fetch product:', err)
        setLoading(false)
      })
  }, [id])

  if (loading) {
    return (
      <div className="min-h-screen flex flex-col items-center justify-center bg-[#0D0D0D] text-[#F5F5F5]">
        <div className="inline-block animate-spin rounded-full h-8 w-8 border-b-2 border-[#3D9A6C]"></div>
        <p className="mt-4 text-[#A1A1A1]">Loading product...</p>
      </div>
    )
  }

  if (!product) {
    return (
      <div className="min-h-screen flex flex-col items-center justify-center bg-[#0D0D0D] text-[#F5F5F5]">
        <h1 className="text-2xl font-bold mb-4">Product not found</h1>
        <Link href="/shop" className="text-[#3D9A6C] underline">Back to Shop</Link>
      </div>
    )
  }

  // All products should have at least 1 variant - default to first variant if none selected
  const defaultVariant = product.variants && product.variants.length > 0 ? product.variants[0] : null
  const effectiveVariantId = selectedVariantId || defaultVariant?.id || null
  const selectedVariant = product.variants?.find(v => v.id === effectiveVariantId) || defaultVariant
  
  // Always use variant pricing (all products should have variants)
  const displayPrice = selectedVariant?.price_cad || 0
  const displayStock = selectedVariant?.stock ?? product.stock
  
  // Update selected variant ID if we defaulted to first variant
  if (!selectedVariantId && defaultVariant) {
    setSelectedVariantId(defaultVariant.id)
  }
  const images = Array.from(new Set([
    product.primaryImage,
    ...(product.images || [])
  ].filter(Boolean)))

  const handleAddToCart = () => {
    if (!product || !selectedVariant) return
    
    // Add to cart using new cart context
    const variant = selectedVariant as any // Type assertion for add-on fields
    addItem({
      productId: product.id,
      productTitle: product.title,
      productImage: product.primaryImage || product.images?.[0] || '/images/placeholder.png',
      category: product.category,
      variantId: selectedVariant.id,
      variantTitle: selectedVariant.variantName,
      sku: selectedVariant.sku,
      regularPrice: selectedVariant.price_cad || 0,
      addonPrice: variant.addonPrice ?? undefined,
      isAddonEligible: variant.isAddonEligible ?? false,
    }, false) // Don't add as addon initially - user can toggle later
    
    addToast({
      title: "Added to cart!",
      description: `${product.title}${selectedVariant ? ` - ${selectedVariant.variantName}` : ''}`,
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
      <header className="sticky top-0 z-50 border-b border-[#2C2C2C] bg-[#1E1E1E]/95 backdrop-blur">
        <div className="container mx-auto flex h-16 items-center justify-between px-4">
          <Link href="/shop" className="flex items-center gap-3 hover:opacity-80 transition-opacity">
            <ArrowLeft className="h-5 w-5" />
            <span className="text-lg font-heading font-bold tracking-wide uppercase">Shop</span>
          </Link>
          <nav className="flex gap-6 items-center">
            <Link href="/" className="text-sm font-medium hover:text-[#3D9A6C] transition-colors">Home</Link>
            <Link href="/clips" className="text-sm font-medium hover:text-[#3D9A6C] transition-colors">Clips</Link>
            <Link href="/account" className="text-sm font-medium hover:text-[#3D9A6C] transition-colors">Account</Link>
            <CartDrawer />
          </nav>
        </div>
      </header>

      <main className="container mx-auto px-4 py-8">
        <div className="grid md:grid-cols-2 gap-10">
          <div className="relative">
            <div className="flex gap-4 overflow-x-auto snap-x snap-mandatory pb-2 [-ms-overflow-style:none] [scrollbar-width:none] [&::-webkit-scrollbar]:hidden">
              {images.map((img, idx) => (
                <div key={idx} className="snap-start shrink-0">
                  <Image
                    src={img}
                    alt={`${product.title} image ${idx + 1}`}
                    width={640}
                    height={640}
                    className="rounded-xl border border-[#2C2C2C] object-cover"
                  />
                </div>
              ))}
            </div>
            {product.detailLongImage && (
              <div className="mt-6">
                <Image
                  src={product.detailLongImage}
                  alt={`${product.title} details`}
                  width={1200}
                  height={4000}
                  className="rounded-xl border border-[#2C2C2C] w-full h-auto"
                />
              </div>
            )}
          </div>

          <div className="flex flex-col gap-6">
            <div>
              <h1 className="text-3xl font-heading font-bold tracking-wide uppercase md:text-4xl text-[#F5F5F5]">
                {product.title}
              </h1>
              {product.category && (
                <span className="inline-block mt-2 text-xs px-3 py-1 bg-[#3D9A6C]/10 text-[#3D9A6C] rounded-full font-medium font-heading uppercase tracking-wide">
                  {product.category}
                </span>
              )}
            </div>

            <div className="flex items-center gap-4">
              <span className="text-3xl font-bold text-[#3D9A6C] font-mono">
                ${displayPrice > 0 ? displayPrice.toFixed(2) : '0.00'}
              </span>
              <span className="text-xs text-[#A1A1A1] font-mono uppercase">CAD</span>
              {!selectedVariant && (
                <span className="text-xs text-yellow-500">(Select a variant to see price)</span>
              )}
            </div>

            {product.description && (
              <div className="prose prose-invert max-w-none text-[#A1A1A1]">
                <p>{product.description}</p>
              </div>
            )}

            {displayStock !== undefined && (
              <div className="text-sm">
                {displayStock > 0 ? (
                  <span className="text-[#3D9A6C]">✓ In Stock</span>
                ) : (
                  <span className="text-red-500">✗ Out of Stock</span>
                )}
              </div>
            )}

            {product.variants && product.variants.length > 0 && (
              <div className="mt-4">
                <p className="text-sm font-medium text-[#F5F5F5] mb-3">
                  {product.variants.length > 1 ? 'Select Variant:' : 'Variant:'}
                </p>
                <MultiVariantSelector
                  variants={product.variants.map(v => ({
                    id: v.id,
                    title: v.variantName,
                    stock: (v.stock ?? 0) > 0 ? 1 : 0,
                    price_cad: v.price_cad ?? product.price_cad,
                    // Multi-dimensional option fields
                    optionType1: v.optionType1,
                    optionValue1: v.optionValue1,
                    optionType2: v.optionType2,
                    optionValue2: v.optionValue2,
                  }))}
                  selectedVariantId={selectedVariantId || product.variants[0].id}
                  onChange={setSelectedVariantId}
                />
              </div>
            )}

            <button
              onClick={handleAddToCart}
              disabled={displayStock === 0}
              className="w-full py-3 px-4 bg-[#3D9A6C] text-black hover:bg-[#3D9A6C]-hover rounded-2xl font-medium font-heading uppercase tracking-wide transition-all flex items-center justify-center gap-2 hover:gap-3 hover:shadow-glow mt-4 disabled:opacity-50 disabled:cursor-not-allowed"
            >
              <ShoppingCart className="h-5 w-5" />
              {displayStock === 0 ? 'Out of Stock' : 'Add to Cart'}
            </button>

          </div>
        </div>
      </main>
    </div>
  )
}
