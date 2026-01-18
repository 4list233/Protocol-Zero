"use client"

import { useState, useEffect } from "react"
import Link from "next/link"
import Image from "next/image"
import { Package, Plus, ShoppingCart } from "lucide-react"
import type { RuntimeProduct } from "@/lib/products"
import { useCart } from "@/lib/cart-context"
import { useToast } from "@/components/toast-provider"

interface BundleDealsProps {
  currentProductId: string
  currentCategory?: string
}

export function BundleDeals({ currentProductId, currentCategory }: BundleDealsProps) {
  const [relatedProducts, setRelatedProducts] = useState<RuntimeProduct[]>([])
  const [loading, setLoading] = useState(true)
  const [selectedBundleItems, setSelectedBundleItems] = useState<Set<string>>(new Set())
  const { addItem } = useCart()
  const { addToast } = useToast()

  useEffect(() => {
    const loadRelatedProducts = async () => {
      try {
        const res = await fetch('/api/products')
        if (res.ok) {
          const allProducts: RuntimeProduct[] = await res.json()
          
          // Filter related products by category and exclude current product
          const related = allProducts
            .filter(p => p.id !== currentProductId && p.category === currentCategory)
            .slice(0, 3) // Show max 3 related products

          setRelatedProducts(related)
        }
      } catch (error) {
        console.error("Failed to load related products:", error)
      }
      setLoading(false)
    }

    loadRelatedProducts()
  }, [currentProductId, currentCategory])

  const toggleBundleItem = (productId: string) => {
    setSelectedBundleItems(prev => {
      const newSet = new Set(prev)
      if (newSet.has(productId)) {
        newSet.delete(productId)
      } else {
        newSet.add(productId)
      }
      return newSet
    })
  }

  const addBundleToCart = () => {
    let itemsAdded = 0

    relatedProducts.forEach(product => {
      if (selectedBundleItems.has(product.id)) {
        const cheapestVariant = product.variants?.[0]
        if (cheapestVariant) {
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
          itemsAdded++
        }
      }
    })

    if (itemsAdded > 0) {
      addToast({
        title: "Bundle added to cart!",
        description: `Added ${itemsAdded} item${itemsAdded > 1 ? 's' : ''} to your cart`
      })
      setSelectedBundleItems(new Set())
    }
  }

  const calculateBundlePrice = () => {
    return relatedProducts
      .filter(p => selectedBundleItems.has(p.id))
      .reduce((sum, p) => sum + (p.variants?.[0]?.price_cad || 0), 0)
  }

  const calculateSavings = () => {
    const total = calculateBundlePrice()
    return total * 0.15 // 15% bundle discount
  }

  if (loading || relatedProducts.length === 0) {
    return null
  }

  return (
    <div className="mt-12 pt-8 border-t border-[#2C2C2C]">
      <div className="bg-gradient-to-r from-[#3D9A6C]/10 to-[#3D9A6C]/5 border border-[#3D9A6C]/30 rounded-2xl p-6">
        <div className="flex items-center gap-3 mb-6">
          <Package className="h-6 w-6 text-[#3D9A6C]" />
          <h3 className="text-xl font-heading font-bold text-[#F5F5F5] tracking-wide uppercase">
            Complete Your Loadout
          </h3>
        </div>

        <p className="text-sm text-[#A1A1A1] mb-6">
          Bundle and save! Select items below to add to your cart together.
        </p>

        <div className="grid md:grid-cols-3 gap-4 mb-6">
          {relatedProducts.map((product) => {
            const isSelected = selectedBundleItems.has(product.id)
            
            return (
              <button
                key={product.id}
                onClick={() => toggleBundleItem(product.id)}
                className={`relative group bg-[#1E1E1E] border-2 rounded-xl overflow-hidden transition-all ${
                  isSelected
                    ? "border-[#3D9A6C] shadow-glow"
                    : "border-[#2C2C2C] hover:border-[#3D9A6C]/50"
                }`}
              >
                {/* Checkmark */}
                {isSelected && (
                  <div className="absolute top-2 right-2 z-10 w-6 h-6 bg-[#3D9A6C] rounded-full flex items-center justify-center">
                    <Plus className="h-4 w-4 text-black rotate-45" />
                  </div>
                )}

                <div className="aspect-square relative bg-[#0D0D0D]">
                  <Image
                    src={product.primaryImage || product.images?.[0] || "/images/placeholder.png"}
                    alt={product.title}
                    fill
                    className="object-cover"
                    sizes="(max-width: 768px) 100vw, 33vw"
                  />
                </div>

                <div className="p-3">
                  <h4 className="text-sm font-semibold text-[#F5F5F5] line-clamp-2 text-left">
                    {product.title}
                  </h4>
                  <p className="text-lg font-bold text-[#3D9A6C] font-mono mt-2 text-left">
                    ${product.variants?.[0]?.price_cad?.toFixed(2) || "0.00"}
                  </p>
                </div>
              </button>
            )
          })}
        </div>

        {/* Bundle Summary */}
        {selectedBundleItems.size > 0 && (
          <div className="bg-[#0D0D0D] border border-[#3D9A6C]/50 rounded-xl p-4">
            <div className="flex items-center justify-between mb-3">
              <span className="text-sm text-[#A1A1A1]">Bundle Total:</span>
              <span className="text-xl font-bold text-[#F5F5F5] font-mono">
                ${calculateBundlePrice().toFixed(2)}
              </span>
            </div>
            <div className="flex items-center justify-between mb-4">
              <span className="text-sm text-[#3D9A6C]">Bundle Savings (15%):</span>
              <span className="text-lg font-bold text-[#3D9A6C] font-mono">
                -${calculateSavings().toFixed(2)}
              </span>
            </div>
            <div className="flex items-center justify-between pt-3 border-t border-[#2C2C2C]">
              <span className="text-sm font-bold text-[#F5F5F5]">You Pay:</span>
              <span className="text-2xl font-bold text-[#3D9A6C] font-mono">
                ${(calculateBundlePrice() - calculateSavings()).toFixed(2)}
              </span>
            </div>

            <button
              onClick={addBundleToCart}
              className="w-full mt-4 py-3 px-4 bg-[#3D9A6C] text-black rounded-lg font-medium hover:bg-[#3D9A6C]/90 transition-colors flex items-center justify-center gap-2"
            >
              <ShoppingCart className="h-5 w-5" />
              Add Bundle to Cart ({selectedBundleItems.size} items)
            </button>
          </div>
        )}

        {selectedBundleItems.size === 0 && (
          <p className="text-center text-sm text-[#A1A1A1] py-4">
            Select items above to create your bundle
          </p>
        )}
      </div>
    </div>
  )
}
