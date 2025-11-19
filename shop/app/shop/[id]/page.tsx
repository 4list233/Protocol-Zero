"use client"

import { useRouter, useSearchParams } from "next/navigation"
import { getProductById } from "../../../lib/products"
import { getProductPrice } from "../../../lib/pricing"
import { getProductTitle } from "../../../lib/display-helpers"
import { addToCart } from "../../../lib/cart"
import Image from "next/image"
import Link from "next/link"
import { useState } from "react"

export default function ProductDetailPage({ params }: { params: { id: string } }) {
  const router = useRouter()
  const product = getProductById(params.id)
  const defaultVariant = product?.variants?.[0]?.option
  const defaultOption = product?.options?.[0]?.values?.[0] || defaultVariant || ""
  const [selectedOption, setSelectedOption] = useState(defaultOption)
  const images = product ? Array.from(new Set([
    product.primaryImage,
    ...(product.images || [])
  ].filter(Boolean))) : []

  if (!product) {
    return (
      <div className="min-h-screen flex flex-col items-center justify-center bg-[#0D0D0D] text-[#F5F5F5]">
        <h1 className="text-2xl font-bold mb-4">Product not found</h1>
        <Link href="/shop" className="text-[#3D9A6C] underline">Back to Shop</Link>
      </div>
    )
  }

  const handleAddToCart = () => {
    // Attach selected option via options field; also duplicate into title for cart clarity if needed
    const enriched = { ...product } as any
    if (selectedOption) {
      enriched.options = product?.options ? [...product.options] : [{ name: 'Colour', values: [] }]
      // Ensure selected option is first for display purposes
      if (enriched.options[0]) {
        enriched.options[0].values = [selectedOption, ...enriched.options[0].values.filter((v: string) => v !== selectedOption)]
      }
    }
    addToCart(enriched, 1)
    router.push("/cart")
  }

  return (
    <div className="min-h-screen bg-[#0D0D0D] text-[#F5F5F5]">
      <div className="container mx-auto px-4 py-8">
        <button
          className="mb-6 flex items-center gap-2 text-sm text-[#A1A1A1] hover:text-[#3D9A6C] transition-colors"
          onClick={() => router.back()}
        >
          ← Back to shop
        </button>
        <div className="grid md:grid-cols-2 gap-10">
          {/* Images + long detail scroll */}
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
          {/* Details */}
          <div className="flex flex-col gap-6">
            <h1 className="text-3xl font-heading font-bold mb-2">{getProductTitle(product)}</h1>
            {product.description && (
              <p className="text-sm text-[#C7C7C7] leading-relaxed">{product.description}</p>
            )}
            <p className="text-lg text-[#A1A1A1] mb-2">{product.category}</p>
            <div className="mb-4">
              <span className="text-2xl font-bold text-[#3D9A6C] font-mono">${getProductPrice(product, selectedOption).toFixed(2)}</span>
              <span className="ml-2 text-xs text-[#A1A1A1] font-mono uppercase">CAD</span>
            </div>
            {/* Options (variants/colors) */}
            {/* Prefer explicit variants if present; fall back to generic options */}
            {product.variants && product.variants.length > 0 ? (
              <div className="mb-4">
                <label className="block text-base font-semibold mb-2">Select Variant</label>
                <select
                  value={selectedOption}
                  onChange={e => setSelectedOption(e.target.value)}
                  className="w-full px-4 py-2 rounded-xl border border-[#2C2C2C] bg-[#1E1E1E] text-[#F5F5F5]"
                >
                  {product.variants.map(v => (
                    <option key={v.option} value={v.option}>{v.option}</option>
                  ))}
                </select>
              </div>
            ) : product.options && product.options.length > 0 ? (
              <div className="mb-4">
                <label className="block text-base font-semibold mb-2">Select {product.options[0].name}</label>
                <select
                  value={selectedOption}
                  onChange={e => setSelectedOption(e.target.value)}
                  className="w-full px-4 py-2 rounded-xl border border-[#2C2C2C] bg-[#1E1E1E] text-[#F5F5F5]"
                >
                  {product.options[0].values.map(v => (
                    <option key={v} value={v}>{v}</option>
                  ))}
                </select>
              </div>
            ) : null}
            <button
              onClick={handleAddToCart}
              className="w-full py-3 px-4 bg-[#3D9A6C] text-black hover:bg-[#3D9A6C]-hover rounded-2xl font-bold font-heading uppercase tracking-wide transition-all"
            >
              Add to Cart
            </button>
          </div>
        </div>
      </div>
    </div>
  )
}
