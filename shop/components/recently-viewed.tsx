"use client"

import { useState, useEffect } from "react"
import { getRecentlyViewed } from "@/lib/recently-viewed"
import Link from "next/link"
import Image from "next/image"
import type { RuntimeProduct } from "@/lib/products"

interface RecentlyViewedProps {
  currentProductId?: string // Exclude current product from list
}

export function RecentlyViewed({ currentProductId }: RecentlyViewedProps) {
  const [products, setProducts] = useState<RuntimeProduct[]>([])
  const [loading, setLoading] = useState(true)

  useEffect(() => {
    const loadRecentlyViewed = async () => {
      const productIds = getRecentlyViewed()
        .filter(id => id !== currentProductId) // Exclude current product
        .slice(0, 4) // Show max 4

      if (productIds.length === 0) {
        setLoading(false)
        return
      }

      try {
        // Fetch product details
        const fetchedProducts = await Promise.all(
          productIds.map(async (id) => {
            try {
              const res = await fetch(`/api/products/${id}`)
              if (res.ok) {
                return await res.json()
              }
              return null
            } catch {
              return null
            }
          })
        )

        setProducts(fetchedProducts.filter(p => p !== null))
      } catch (error) {
        console.error("Failed to load recently viewed:", error)
      }

      setLoading(false)
    }

    loadRecentlyViewed()
  }, [currentProductId])

  if (loading || products.length === 0) {
    return null
  }

  return (
    <div className="mt-12 pt-8 border-t border-[#2C2C2C]">
      <h3 className="text-xl font-heading font-bold mb-6 text-[#F5F5F5] tracking-wide uppercase">
        Recently Viewed
      </h3>
      <div className="grid grid-cols-2 md:grid-cols-4 gap-4">
        {products.map((product) => (
          <Link
            key={product.id}
            href={`/shop/${product.id}`}
            className="group bg-[#1E1E1E] border-2 border-[#2C2C2C] rounded-xl overflow-hidden hover:border-[#3D9A6C] transition-all hover:scale-105"
          >
            <div className="aspect-square relative bg-[#0D0D0D]">
              <Image
                src={product.primaryImage || product.images?.[0] || "/images/placeholder.png"}
                alt={product.title}
                fill
                className="object-cover group-hover:scale-110 transition-transform duration-300"
                sizes="(max-width: 768px) 50vw, 25vw"
              />
            </div>
            <div className="p-3">
              <h4 className="text-sm font-semibold text-[#F5F5F5] line-clamp-2 group-hover:text-[#3D9A6C] transition-colors">
                {product.title}
              </h4>
              <p className="text-lg font-bold text-[#3D9A6C] font-mono mt-2">
                ${product.variants && product.variants.length > 0
                  ? (product.variants[0].price_cad || 0).toFixed(2)
                  : "0.00"}
              </p>
            </div>
          </Link>
        ))}
      </div>
    </div>
  )
}
