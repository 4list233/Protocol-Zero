"use client"

import { useRef, useState, useEffect } from "react"
import { ChevronLeft, ChevronRight } from "lucide-react"
import Link from "next/link"
import Image from "next/image"
import type { RuntimeProduct } from "@/lib/products"
import { slugifyCategory } from "@/lib/categories"
import { NewBadge } from "@/components/new-badge"
import { QuickViewButton } from "@/components/quick-view-modal"
import { WishlistButton } from "@/components/wishlist-button"

type CategoryRowProps = {
  categoryName: string
  products: RuntimeProduct[]
  rowSize: number
  newWindowDays: number
  onAddToCart?: (product: RuntimeProduct) => void
  /** If true, don't show the "View All" link (e.g., on a category page) */
  hideViewAll?: boolean
  /** Custom link for "View All" (defaults to /shop/category/[slug]) */
  viewAllHref?: string
}

export function CategoryRow({
  categoryName,
  products,
  rowSize,
  newWindowDays,
  onAddToCart,
  hideViewAll = false,
  viewAllHref,
}: CategoryRowProps) {
  const scrollRef = useRef<HTMLDivElement>(null)
  const [canScrollLeft, setCanScrollLeft] = useState(false)
  const [canScrollRight, setCanScrollRight] = useState(false)

  const checkScroll = () => {
    const el = scrollRef.current
    if (!el) return
    setCanScrollLeft(el.scrollLeft > 4)
    setCanScrollRight(el.scrollLeft + el.clientWidth < el.scrollWidth - 4)
  }

  useEffect(() => {
    checkScroll()
    const el = scrollRef.current
    if (!el) return
    el.addEventListener("scroll", checkScroll, { passive: true })
    const ro = new ResizeObserver(checkScroll)
    ro.observe(el)
    return () => {
      el.removeEventListener("scroll", checkScroll)
      ro.disconnect()
    }
  }, [products])

  const scroll = (direction: "left" | "right") => {
    const el = scrollRef.current
    if (!el) return
    const cardWidth = el.querySelector("[data-card]")?.clientWidth || 280
    const gap = 24
    const distance = (cardWidth + gap) * 2
    el.scrollBy({ left: direction === "left" ? -distance : distance, behavior: "smooth" })
  }

  const slug = slugifyCategory(categoryName)
  const href = viewAllHref || `/shop/category/${slug}`

  return (
    <section className="relative group/row">
      {/* Row Header */}
      <div className="flex items-center justify-between mb-4">
        <div className="flex items-center gap-3">
          <h2 className="text-xl font-heading font-bold tracking-wide uppercase text-[#F5F5F5]">
            {categoryName}
          </h2>
          <span className="text-xs text-[#A1A1A1] font-mono">
            {products.length} {products.length === 1 ? "item" : "items"}
          </span>
        </div>
        {!hideViewAll && (
          <Link
            href={href}
            className="text-sm font-medium text-[#3D9A6C] hover:text-[#4dba84] transition-colors flex items-center gap-1"
          >
            View All <ChevronRight className="h-4 w-4" />
          </Link>
        )}
      </div>

      {/* Scroll Container */}
      <div className="relative">
        {/* Left Arrow */}
        {canScrollLeft && (
          <button
            onClick={() => scroll("left")}
            className="hidden md:flex absolute left-0 top-1/2 -translate-y-1/2 z-10 -ml-4 w-10 h-10 items-center justify-center rounded-full bg-[#1E1E1E]/90 border border-[#2C2C2C] text-[#F5F5F5] shadow-lg hover:bg-[#3D9A6C] hover:border-[#3D9A6C] hover:text-black transition-all"
            aria-label="Scroll left"
          >
            <ChevronLeft className="h-5 w-5" />
          </button>
        )}

        {/* Cards */}
        <div
          ref={scrollRef}
          className="flex gap-6 overflow-x-auto scroll-smooth snap-x snap-mandatory scrollbar-hide pb-2"
          style={{ scrollbarWidth: "none", msOverflowStyle: "none" }}
        >
          {products.map((product) => (
            <ProductRowCard
              key={product.id}
              product={product}
              newWindowDays={newWindowDays}
              onAddToCart={onAddToCart}
            />
          ))}
        </div>

        {/* Right Arrow */}
        {canScrollRight && (
          <button
            onClick={() => scroll("right")}
            className="hidden md:flex absolute right-0 top-1/2 -translate-y-1/2 z-10 -mr-4 w-10 h-10 items-center justify-center rounded-full bg-[#1E1E1E]/90 border border-[#2C2C2C] text-[#F5F5F5] shadow-lg hover:bg-[#3D9A6C] hover:border-[#3D9A6C] hover:text-black transition-all"
            aria-label="Scroll right"
          >
            <ChevronRight className="h-5 w-5" />
          </button>
        )}
      </div>
    </section>
  )
}

function ProductRowCard({
  product,
  newWindowDays,
  onAddToCart,
}: {
  product: RuntimeProduct
  newWindowDays: number
  onAddToCart?: (product: RuntimeProduct) => void
}) {
  const cheapestPrice = product.variants?.reduce((min, v) => {
    const p = v.price_cad || 0
    return p < min ? p : min
  }, Number.POSITIVE_INFINITY) || 0

  return (
    <div
      data-card
      className="flex-shrink-0 snap-start w-[calc(50%-12px)] md:w-[calc(25%-18px)] xl:w-[calc(16.666%-20px)] group bg-[#1E1E1E] border-2 border-[#2C2C2C] rounded-2xl overflow-hidden hover:border-[#3D9A6C] hover:shadow-card transition-all hover:scale-[1.02]"
    >
      <Link href={`/shop/${product.id}`} className="block relative">
        <div className="aspect-square relative bg-[#0D0D0D] overflow-hidden">
          <Image
            src={product.primaryImage || product.images?.[0] || "/images/placeholder.png"}
            alt={product.title}
            fill
            className="object-cover group-hover:scale-105 transition-transform duration-300"
            sizes="(max-width: 768px) 50vw, (max-width: 1280px) 25vw, 16.7vw"
          />
          <NewBadge createdAt={product.createdAt} windowDays={newWindowDays} />
          <QuickViewButton productId={product.id} />
        </div>
      </Link>
      <div className="p-3 space-y-2">
        <div className="flex items-start justify-between gap-2">
          <Link href={`/shop/${product.id}`} className="flex-1 hover:opacity-90">
            <h3 className="font-semibold font-body text-sm line-clamp-2 text-[#F5F5F5] group-hover:text-[#3D9A6C] transition-colors">
              {product.title}
            </h3>
          </Link>
          <WishlistButton productId={product.id} productTitle={product.title} className="flex-shrink-0" />
        </div>
        {product.variants && product.variants.length > 1 && (
          <p className="text-xs text-[#3D9A6C] font-semibold">Multiple variants</p>
        )}
        <div className="flex items-center justify-between pt-1 border-t border-[#2C2C2C]">
          <span className="text-lg font-bold text-[#3D9A6C] font-mono">
            ${cheapestPrice === Infinity ? "0.00" : cheapestPrice.toFixed(2)}
          </span>
          <span className="text-[10px] text-[#A1A1A1] font-mono uppercase">CAD</span>
        </div>
      </div>
    </div>
  )
}
