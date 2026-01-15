"use client"

import { useState, useEffect } from "react"
import Image from "next/image"
import { X, Eye, ShoppingCart } from "lucide-react"
import Link from "next/link"
import type { RuntimeProduct } from "@/lib/products"
import { useCart } from "@/lib/cart-context"
import { useToast } from "@/components/toast-provider"

interface QuickViewModalProps {
  productId: string
  isOpen: boolean
  onClose: () => void
}

export function QuickViewModal({ productId, isOpen, onClose }: QuickViewModalProps) {
  const [product, setProduct] = useState<RuntimeProduct | null>(null)
  const [loading, setLoading] = useState(true)
  const [selectedVariantId, setSelectedVariantId] = useState<string | null>(null)
  const { addItem } = useCart()
  const { addToast } = useToast()

  useEffect(() => {
    if (!isOpen) return

    setLoading(true)
    fetch(`/api/products/${productId}`)
      .then(res => res.json())
      .then(data => {
        setProduct(data)
        if (data.variants && data.variants.length > 0) {
          setSelectedVariantId(data.variants[0].id)
        }
        setLoading(false)
      })
      .catch(() => setLoading(false))

    // Prevent body scroll
    document.body.style.overflow = "hidden"

    return () => {
      document.body.style.overflow = ""
    }
  }, [productId, isOpen])

  if (!isOpen) return null

  const handleAddToCart = () => {
    if (!product || !selectedVariantId) return

    const selectedVariant = product.variants?.find(v => v.id === selectedVariantId)
    if (!selectedVariant) return

    const variant = selectedVariant as any
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
    }, false)

    addToast({
      title: "Added to cart!",
      description: `${product.title} - ${selectedVariant.variantName}`
    })

    onClose()
  }

  return (
    <div className="fixed inset-0 z-[100] bg-black/90 backdrop-blur-sm flex items-center justify-center p-4 overflow-y-auto" onClick={onClose}>
      <div
        className="relative bg-[#1E1E1E] border border-[#2C2C2C] rounded-2xl max-w-5xl w-full"
        onClick={(e) => e.stopPropagation()}
      >
        {/* Close Button */}
        <button
          onClick={onClose}
          className="absolute top-4 right-4 z-10 p-2 bg-[#0D0D0D] hover:bg-[#2C2C2C] rounded-lg transition-colors"
        >
          <X className="h-5 w-5 text-[#A1A1A1]" />
        </button>

        {loading ? (
          <div className="p-12 text-center">
            <div className="inline-block animate-spin rounded-full h-8 w-8 border-b-2 border-[#3D9A6C]"></div>
            <p className="mt-4 text-[#A1A1A1]">Loading...</p>
          </div>
        ) : product ? (
          <div className="grid md:grid-cols-2 gap-6 p-6">
            {/* Left: Image */}
            <div className="relative aspect-square rounded-xl overflow-hidden border border-[#2C2C2C] bg-[#0D0D0D]">
              <Image
                src={product.primaryImage || product.images?.[0] || "/images/placeholder.png"}
                alt={product.title}
                fill
                className="object-contain"
                priority
              />
            </div>

            {/* Right: Product Info */}
            <div className="flex flex-col gap-4">
              <div>
                <h2 className="text-2xl font-heading font-bold text-[#F5F5F5] tracking-wide uppercase">
                  {product.title}
                </h2>
                {product.category && (
                  <span className="inline-block mt-2 text-xs px-3 py-1 bg-[#3D9A6C]/10 text-[#3D9A6C] rounded-full font-medium font-heading uppercase tracking-wide">
                    {product.category}
                  </span>
                )}
              </div>

              <div className="flex items-center gap-4">
                <span className="text-3xl font-bold text-[#3D9A6C] font-mono">
                  ${product.variants && product.variants.length > 0
                    ? (product.variants.find(v => v.id === selectedVariantId)?.price_cad || 0).toFixed(2)
                    : "0.00"}
                </span>
                <span className="text-xs text-[#A1A1A1] font-mono uppercase">CAD</span>
              </div>

              {product.description && (
                <p className="text-sm text-[#A1A1A1] line-clamp-3">{product.description}</p>
              )}

              {/* Variant Selector */}
              {product.variants && product.variants.length > 1 && (
                <div>
                  <label className="block text-sm font-medium text-[#F5F5F5] mb-2">
                    Select Variant:
                  </label>
                  <div className="flex flex-wrap gap-2">
                    {product.variants.map((variant) => (
                      <button
                        key={variant.id}
                        onClick={() => setSelectedVariantId(variant.id)}
                        className={`px-3 py-2 rounded-lg text-sm font-medium border transition-all ${
                          selectedVariantId === variant.id
                            ? "bg-[#3D9A6C] text-black border-[#3D9A6C]"
                            : "bg-[#0D0D0D] text-[#F5F5F5] border-[#2C2C2C] hover:border-[#3D9A6C]"
                        }`}
                      >
                        {variant.variantName}
                      </button>
                    ))}
                  </div>
                </div>
              )}

              {/* Actions */}
              <div className="flex gap-3 mt-auto">
                <button
                  onClick={handleAddToCart}
                  disabled={!selectedVariantId}
                  className="flex-1 flex items-center justify-center gap-2 px-6 py-3 bg-[#3D9A6C] text-black rounded-lg font-medium hover:bg-[#3D9A6C]/90 transition-colors disabled:opacity-50 disabled:cursor-not-allowed"
                >
                  <ShoppingCart className="h-5 w-5" />
                  Add to Cart
                </button>
                <Link
                  href={`/shop/${product.id}`}
                  className="px-6 py-3 bg-[#0D0D0D] text-[#F5F5F5] border border-[#2C2C2C] rounded-lg font-medium hover:border-[#3D9A6C] transition-colors text-center"
                  onClick={onClose}
                >
                  View Full Details
                </Link>
              </div>
            </div>
          </div>
        ) : (
          <div className="p-12 text-center">
            <p className="text-[#A1A1A1]">Product not found</p>
          </div>
        )}
      </div>
    </div>
  )
}

// Quick View Button Component (for product cards)
interface QuickViewButtonProps {
  productId: string
  className?: string
}

export function QuickViewButton({ productId, className = "" }: QuickViewButtonProps) {
  const [isOpen, setIsOpen] = useState(false)

  return (
    <>
      <button
        onClick={(e) => {
          e.preventDefault()
          e.stopPropagation()
          setIsOpen(true)
        }}
        className={`absolute top-2 right-2 p-2 bg-[#1E1E1E]/90 backdrop-blur rounded-full opacity-0 group-hover:opacity-100 transition-all hover:bg-[#3D9A6C] hover:text-black z-10 ${className}`}
        title="Quick View"
      >
        <Eye className="h-4 w-4" />
      </button>
      <QuickViewModal productId={productId} isOpen={isOpen} onClose={() => setIsOpen(false)} />
    </>
  )
}
