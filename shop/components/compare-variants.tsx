"use client"

import { useState } from "react"
import Image from "next/image"
import { X, ArrowLeftRight } from "lucide-react"
import type { ProductVariant } from "@/lib/products"

interface CompareVariantsProps {
  variants: ProductVariant[]
  productTitle: string
  productImage?: string
}

export function CompareVariants({ variants, productTitle, productImage }: CompareVariantsProps) {
  const [isOpen, setIsOpen] = useState(false)
  const [variant1, setVariant1] = useState<ProductVariant | null>(variants[0] || null)
  const [variant2, setVariant2] = useState<ProductVariant | null>(variants[1] || null)

  if (variants.length < 2) {
    return null // Need at least 2 variants to compare
  }

  return (
    <>
      {/* Trigger Button */}
      <button
        onClick={() => setIsOpen(true)}
        className="flex items-center gap-2 px-4 py-2 bg-[#1E1E1E] border border-[#2C2C2C] rounded-lg text-sm text-[#A1A1A1] hover:text-[#3D9A6C] hover:border-[#3D9A6C] transition-colors"
      >
        <ArrowLeftRight className="h-4 w-4" />
        <span>Compare Variants</span>
      </button>

      {/* Modal */}
      {isOpen && (
        <div className="fixed inset-0 z-[100] bg-black/90 backdrop-blur-sm flex items-center justify-center p-4 overflow-y-auto">
          <div className="relative bg-[#1E1E1E] border border-[#2C2C2C] rounded-2xl max-w-4xl w-full p-6">
            {/* Close Button */}
            <button
              onClick={() => setIsOpen(false)}
              className="absolute top-4 right-4 p-2 hover:bg-[#2C2C2C] rounded-lg transition-colors"
            >
              <X className="h-5 w-5 text-[#A1A1A1]" />
            </button>

            <h2 className="text-2xl font-heading font-bold mb-6 text-[#F5F5F5] tracking-wide uppercase">
              Compare Variants
            </h2>

            <div className="grid md:grid-cols-2 gap-6">
              {/* Variant 1 */}
              <div className="bg-[#0D0D0D] border-2 border-[#2C2C2C] rounded-xl p-4">
                <select
                  value={variant1?.id || ""}
                  onChange={(e) => {
                    const selected = variants.find(v => v.id === e.target.value)
                    setVariant1(selected || null)
                  }}
                  className="w-full mb-4 px-3 py-2 bg-[#1E1E1E] border border-[#2C2C2C] rounded-lg text-[#F5F5F5] focus:outline-none focus:border-[#3D9A6C]"
                >
                  {variants.map(v => (
                    <option key={v.id} value={v.id}>
                      {v.variantName}
                    </option>
                  ))}
                </select>

                {variant1 && (
                  <>
                    <div className="aspect-square relative bg-[#1E1E1E] rounded-lg overflow-hidden mb-4">
                      <Image
                        src={productImage || "/images/placeholder.png"}
                        alt={variant1.variantName}
                        fill
                        className="object-cover"
                      />
                    </div>

                    <div className="space-y-3 text-sm">
                      <div className="flex justify-between">
                        <span className="text-[#A1A1A1]">Variant:</span>
                        <span className="text-[#F5F5F5] font-semibold">{variant1.variantName}</span>
                      </div>
                      <div className="flex justify-between">
                        <span className="text-[#A1A1A1]">Price:</span>
                        <span className="text-[#3D9A6C] font-bold font-mono">
                          ${(variant1.price_cad || 0).toFixed(2)}
                        </span>
                      </div>
                      <div className="flex justify-between">
                        <span className="text-[#A1A1A1]">SKU:</span>
                        <span className="text-[#F5F5F5] font-mono text-xs">{variant1.sku}</span>
                      </div>
                      <div className="flex justify-between">
                        <span className="text-[#A1A1A1]">Stock:</span>
                        <span className={`font-semibold ${(variant1.stock ?? 0) > 0 ? "text-[#3D9A6C]" : "text-red-500"}`}>
                          {(variant1.stock ?? 0) > 0 ? "✓ In Stock" : "✗ Out of Stock"}
                        </span>
                      </div>
                      {variant1.optionType1 && variant1.optionValue1 && (
                        <div className="flex justify-between">
                          <span className="text-[#A1A1A1]">{variant1.optionType1}:</span>
                          <span className="text-[#F5F5F5]">{variant1.optionValue1}</span>
                        </div>
                      )}
                      {variant1.optionType2 && variant1.optionValue2 && (
                        <div className="flex justify-between">
                          <span className="text-[#A1A1A1]">{variant1.optionType2}:</span>
                          <span className="text-[#F5F5F5]">{variant1.optionValue2}</span>
                        </div>
                      )}
                    </div>
                  </>
                )}
              </div>

              {/* Variant 2 */}
              <div className="bg-[#0D0D0D] border-2 border-[#2C2C2C] rounded-xl p-4">
                <select
                  value={variant2?.id || ""}
                  onChange={(e) => {
                    const selected = variants.find(v => v.id === e.target.value)
                    setVariant2(selected || null)
                  }}
                  className="w-full mb-4 px-3 py-2 bg-[#1E1E1E] border border-[#2C2C2C] rounded-lg text-[#F5F5F5] focus:outline-none focus:border-[#3D9A6C]"
                >
                  {variants.map(v => (
                    <option key={v.id} value={v.id}>
                      {v.variantName}
                    </option>
                  ))}
                </select>

                {variant2 && (
                  <>
                    <div className="aspect-square relative bg-[#1E1E1E] rounded-lg overflow-hidden mb-4">
                      <Image
                        src={productImage || "/images/placeholder.png"}
                        alt={variant2.variantName}
                        fill
                        className="object-cover"
                      />
                    </div>

                    <div className="space-y-3 text-sm">
                      <div className="flex justify-between">
                        <span className="text-[#A1A1A1]">Variant:</span>
                        <span className="text-[#F5F5F5] font-semibold">{variant2.variantName}</span>
                      </div>
                      <div className="flex justify-between">
                        <span className="text-[#A1A1A1]">Price:</span>
                        <span className="text-[#3D9A6C] font-bold font-mono">
                          ${(variant2.price_cad || 0).toFixed(2)}
                        </span>
                      </div>
                      <div className="flex justify-between">
                        <span className="text-[#A1A1A1]">SKU:</span>
                        <span className="text-[#F5F5F5] font-mono text-xs">{variant2.sku}</span>
                      </div>
                      <div className="flex justify-between">
                        <span className="text-[#A1A1A1]">Stock:</span>
                        <span className={`font-semibold ${(variant2.stock ?? 0) > 0 ? "text-[#3D9A6C]" : "text-red-500"}`}>
                          {(variant2.stock ?? 0) > 0 ? "✓ In Stock" : "✗ Out of Stock"}
                        </span>
                      </div>
                      {variant2.optionType1 && variant2.optionValue1 && (
                        <div className="flex justify-between">
                          <span className="text-[#A1A1A1]">{variant2.optionType1}:</span>
                          <span className="text-[#F5F5F5]">{variant2.optionValue1}</span>
                        </div>
                      )}
                      {variant2.optionType2 && variant2.optionValue2 && (
                        <div className="flex justify-between">
                          <span className="text-[#A1A1A1]">{variant2.optionType2}:</span>
                          <span className="text-[#F5F5F5]">{variant2.optionValue2}</span>
                        </div>
                      )}
                    </div>
                  </>
                )}
              </div>
            </div>

            {/* Price Difference */}
            {variant1 && variant2 && (
              <div className="mt-6 p-4 bg-[#3D9A6C]/10 border border-[#3D9A6C]/50 rounded-lg">
                <p className="text-sm text-[#A1A1A1]">
                  Price difference:{" "}
                  <span className="text-[#3D9A6C] font-bold font-mono">
                    ${Math.abs((variant1.price_cad || 0) - (variant2.price_cad || 0)).toFixed(2)}
                  </span>
                </p>
              </div>
            )}
          </div>
        </div>
      )}
    </>
  )
}
