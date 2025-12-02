"use client"

import React, { useMemo, useEffect } from "react"

/**
 * Variant data structure with optional multi-dimensional options
 */
export interface MultiVariant {
  id: string
  title: string           // variantName - display name
  stock: number
  price_cad: number
  // Multi-dimensional options
  optionType1?: string    // e.g., "Color"
  optionValue1?: string   // e.g., "Black"
  optionType2?: string    // e.g., "Size"
  optionValue2?: string   // e.g., "M"
}

export interface MultiVariantSelectorProps {
  variants: MultiVariant[]
  selectedVariantId: string
  onChange: (variantId: string) => void
}

/**
 * Extract unique option values for a given option type
 */
function getUniqueOptions(
  variants: MultiVariant[],
  optionKey: 'optionValue1' | 'optionValue2'
): string[] {
  const values = new Set<string>()
  for (const v of variants) {
    const val = v[optionKey]
    if (val) values.add(val)
  }
  return Array.from(values)
}

/**
 * Check if variants have multi-dimensional structured options
 */
function hasStructuredOptions(variants: MultiVariant[]): boolean {
  return variants.some(v => v.optionType1 && v.optionValue1)
}

/**
 * Find variant by option selections
 */
function findVariantByOptions(
  variants: MultiVariant[],
  option1Value: string | null,
  option2Value: string | null
): MultiVariant | null {
  for (const v of variants) {
    const matches1 = !option1Value || v.optionValue1 === option1Value
    const matches2 = !option2Value || !v.optionType2 || v.optionValue2 === option2Value
    if (matches1 && matches2) return v
  }
  return null
}

/**
 * Multi-dimensional variant selector with Taobao-style option selection
 * Falls back to simple button list if variants don't have structured options
 */
export default function MultiVariantSelector({
  variants,
  selectedVariantId,
  onChange,
}: MultiVariantSelectorProps) {
  // Check if we have structured multi-dimensional options
  const isMultiDimensional = useMemo(() => hasStructuredOptions(variants), [variants])

  // Get the selected variant
  const selectedVariant = useMemo(
    () => variants.find(v => v.id === selectedVariantId) || variants[0],
    [variants, selectedVariantId]
  )

  // Extract option types and values
  const optionType1 = useMemo(() => {
    for (const v of variants) {
      if (v.optionType1) return v.optionType1
    }
    return null
  }, [variants])

  const optionType2 = useMemo(() => {
    for (const v of variants) {
      if (v.optionType2) return v.optionType2
    }
    return null
  }, [variants])

  const option1Values = useMemo(() => getUniqueOptions(variants, 'optionValue1'), [variants])
  
  // Filter option2 values based on selected option1
  const option2Values = useMemo(() => {
    if (!optionType2) return []
    const selectedOption1 = selectedVariant?.optionValue1
    const filtered = variants.filter(v => !selectedOption1 || v.optionValue1 === selectedOption1)
    return getUniqueOptions(filtered, 'optionValue2')
  }, [variants, optionType2, selectedVariant])

  // Handle option1 selection
  const handleOption1Change = (value: string) => {
    // Find a variant with this option1 value
    // Prefer one with the same option2 if possible
    const currentOption2 = selectedVariant?.optionValue2
    let newVariant = variants.find(v => v.optionValue1 === value && v.optionValue2 === currentOption2)
    if (!newVariant) {
      newVariant = variants.find(v => v.optionValue1 === value)
    }
    if (newVariant) {
      onChange(newVariant.id)
    }
  }

  // Handle option2 selection
  const handleOption2Change = (value: string) => {
    const currentOption1 = selectedVariant?.optionValue1
    const newVariant = variants.find(
      v => v.optionValue1 === currentOption1 && v.optionValue2 === value
    )
    if (newVariant) {
      onChange(newVariant.id)
    }
  }

  // Check if an option combination is available (has stock)
  const isOption1Available = (value: string): boolean => {
    return variants.some(v => v.optionValue1 === value && (v.stock ?? 0) > 0)
  }

  const isOption2Available = (value: string): boolean => {
    const currentOption1 = selectedVariant?.optionValue1
    return variants.some(
      v => v.optionValue1 === currentOption1 && v.optionValue2 === value && (v.stock ?? 0) > 0
    )
  }

  // If not multi-dimensional, render simple button list (backward compatible)
  if (!isMultiDimensional) {
    return (
      <div className="flex gap-2 flex-wrap">
        {variants.map((variant) => (
          <button
            key={variant.id}
            type="button"
            className={`px-3 py-1.5 rounded-lg text-sm font-medium border transition-all ${
              selectedVariantId === variant.id
                ? "bg-[#3D9A6C] text-black border-[#3D9A6C] shadow-md"
                : "bg-[#1E1E1E] text-[#F5F5F5] border-[#2C2C2C] hover:border-[#3D9A6C]/50 hover:bg-[#2C2C2C]"
            } ${variant.stock === 0 ? "opacity-50" : ""}`}
            onClick={() => onChange(variant.id)}
            disabled={variant.stock === 0}
          >
            {variant.title}
            {variant.stock === 0 && <span className="ml-1.5 text-red-400 text-xs">(Sold out)</span>}
          </button>
        ))}
      </div>
    )
  }

  // Multi-dimensional selector UI
  return (
    <div className="space-y-4">
      {/* Option 1 (e.g., Color) */}
      {optionType1 && option1Values.length > 0 && (
        <div>
          <label className="block text-sm font-medium text-[#A1A1A1] mb-2">
            {optionType1}
            {selectedVariant?.optionValue1 && (
              <span className="ml-2 text-[#F5F5F5]">: {selectedVariant.optionValue1}</span>
            )}
          </label>
          <div className="flex gap-2 flex-wrap">
            {option1Values.map((value) => {
              const isSelected = selectedVariant?.optionValue1 === value
              const isAvailable = isOption1Available(value)
              return (
                <button
                  key={value}
                  type="button"
                  onClick={() => handleOption1Change(value)}
                  disabled={!isAvailable}
                  className={`px-4 py-2 rounded-lg text-sm font-medium border transition-all ${
                    isSelected
                      ? "bg-[#3D9A6C] text-black border-[#3D9A6C] shadow-md"
                      : isAvailable
                        ? "bg-[#1E1E1E] text-[#F5F5F5] border-[#2C2C2C] hover:border-[#3D9A6C]/50 hover:bg-[#2C2C2C]"
                        : "bg-[#1E1E1E] text-[#666] border-[#2C2C2C] opacity-50 cursor-not-allowed line-through"
                  }`}
                >
                  {value}
                </button>
              )
            })}
          </div>
        </div>
      )}

      {/* Option 2 (e.g., Size) */}
      {optionType2 && option2Values.length > 0 && (
        <div>
          <label className="block text-sm font-medium text-[#A1A1A1] mb-2">
            {optionType2}
            {selectedVariant?.optionValue2 && (
              <span className="ml-2 text-[#F5F5F5]">: {selectedVariant.optionValue2}</span>
            )}
          </label>
          <div className="flex gap-2 flex-wrap">
            {option2Values.map((value) => {
              const isSelected = selectedVariant?.optionValue2 === value
              const isAvailable = isOption2Available(value)
              return (
                <button
                  key={value}
                  type="button"
                  onClick={() => handleOption2Change(value)}
                  disabled={!isAvailable}
                  className={`px-4 py-2 rounded-lg text-sm font-medium border transition-all ${
                    isSelected
                      ? "bg-[#3D9A6C] text-black border-[#3D9A6C] shadow-md"
                      : isAvailable
                        ? "bg-[#1E1E1E] text-[#F5F5F5] border-[#2C2C2C] hover:border-[#3D9A6C]/50 hover:bg-[#2C2C2C]"
                        : "bg-[#1E1E1E] text-[#666] border-[#2C2C2C] opacity-50 cursor-not-allowed line-through"
                  }`}
                >
                  {value}
                </button>
              )
            })}
          </div>
        </div>
      )}

      {/* Show selected variant info */}
      {selectedVariant && (
        <div className="text-xs text-[#666] mt-2 pt-2 border-t border-[#2C2C2C]">
          Selected: <span className="text-[#A1A1A1]">{selectedVariant.title}</span>
        </div>
      )}
    </div>
  )
}

