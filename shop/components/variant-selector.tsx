import React from "react"

export interface VariantSelectorProps {
  variants: Array<{ id: string; title: string; stock: number; price_cad: number }>
  selectedVariantId: string
  onChange: (variantId: string) => void
}

export default function VariantSelector({ variants, selectedVariantId, onChange }: VariantSelectorProps) {
  return (
    <div className="flex gap-2 flex-wrap">
      {variants.map((variant) => (
        <button
          key={variant.id}
          type="button"
          className={`px-3 py-1 rounded-full text-xs font-medium border transition-colors ${
            selectedVariantId === variant.id
              ? "bg-[#3D9A6C] text-black border-[#3D9A6C]"
              : "bg-[#3D9A6C]/10 text-[#3D9A6C] border-[#2C2C2C] hover:bg-[#3D9A6C]/30"
          }`}
          onClick={() => onChange(variant.id)}
          disabled={variant.stock === 0}
        >
          {variant.title}
          {variant.stock === 0 && <span className="ml-2 text-red-500">(Out of stock)</span>}
        </button>
      ))}
    </div>
  )
}
