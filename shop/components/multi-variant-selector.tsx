"use client"

import React, { useMemo } from "react"

/**
 * Variant data structure with optional multi-dimensional options
 */
export interface MultiVariant {
  id: string
  title: string           // variantName - display name
  stock: number
  price_cad: number
  // Multi-dimensional options (kept for "Available Options" dropdown support)
  optionType1?: string
  optionValue1?: string
  optionType2?: string    // e.g., "Available Sizes"
  optionValue2?: string   // e.g., "XXS,XS,S,M,L" (comma-separated)
}

export interface MultiVariantSelectorProps {
  variants: MultiVariant[]
  selectedVariantId: string
  onChange: (variantId: string) => void
  onOption2Change?: (selectedOption: string) => void
  selectedOption2?: string
}

/**
 * Flat variant selector - displays all variants as individually selectable buttons
 * using their full variant name. No categorization or grouping.
 *
 * If the selected variant has an "Available Options" type (comma-separated list
 * in optionValue2), a dropdown is shown below for sub-selection (e.g., size picker).
 */
export default function MultiVariantSelector({
  variants,
  selectedVariantId,
  onChange,
  onOption2Change,
  selectedOption2,
}: MultiVariantSelectorProps) {
  const selectedVariant = useMemo(() => {
    const fromId = variants.find(v => v.id === selectedVariantId)
    if (fromId) return fromId
    return variants[0]
  }, [variants, selectedVariantId])

  // Check if the selected variant has an "Available Options" dropdown
  const availableOptions = useMemo(() => {
    if (!selectedVariant?.optionType2) return null
    if (!selectedVariant.optionType2.toLowerCase().includes('available')) return null
    if (!selectedVariant.optionValue2) return null
    const options = selectedVariant.optionValue2.split(',').map(s => s.trim()).filter(Boolean)
    return options.length > 0 ? options : null
  }, [selectedVariant])

  const dropdownLabel = useMemo(() => {
    if (!selectedVariant?.optionType2) return 'Option'
    return selectedVariant.optionType2.replace(/available\s*/i, '').trim() || 'Option'
  }, [selectedVariant])

  return (
    <div className="space-y-4">
      {/* Flat variant button list */}
      <div className="flex gap-2 flex-wrap">
        {variants.map((variant) => {
          const isSelected = selectedVariantId === variant.id
          const isOutOfStock = variant.stock === 0
          return (
            <button
              key={variant.id}
              type="button"
              onClick={() => {
                onChange(variant.id)
                // Clear the sub-option when switching variants
                if (onOption2Change) {
                  onOption2Change('')
                }
              }}
              disabled={isOutOfStock}
              className={`px-3 py-1.5 rounded-lg text-sm font-medium border transition-all ${
                isSelected
                  ? "bg-[#3D9A6C] text-black border-[#3D9A6C] shadow-md"
                  : isOutOfStock
                    ? "bg-[#1E1E1E] text-[#666] border-[#2C2C2C] opacity-50 cursor-not-allowed line-through"
                    : "bg-[#1E1E1E] text-[#F5F5F5] border-[#2C2C2C] hover:border-[#3D9A6C]/50 hover:bg-[#2C2C2C]"
              }`}
            >
              {variant.title}
              {isOutOfStock && <span className="ml-1.5 text-red-400 text-xs">(Sold out)</span>}
            </button>
          )
        })}
      </div>

      {/* "Available Options" dropdown for variants with comma-separated sub-options */}
      {availableOptions && (
        <div>
          <label className="block text-sm font-medium text-[#A1A1A1] mb-2">
            {dropdownLabel}
            {selectedOption2 && (
              <span className="ml-2 text-[#F5F5F5]">: {selectedOption2}</span>
            )}
          </label>
          <select
            value={selectedOption2 || ''}
            onChange={(e) => {
              if (onOption2Change) {
                onOption2Change(e.target.value)
              }
            }}
            className="w-full px-4 py-2 rounded-lg text-sm font-medium bg-[#1E1E1E] text-[#F5F5F5] border border-[#2C2C2C] hover:border-[#3D9A6C]/50 focus:border-[#3D9A6C] focus:outline-none transition-all"
          >
            <option value="">Select {dropdownLabel}</option>
            {availableOptions.map((value) => (
              <option key={value} value={value}>
                {value}
              </option>
            ))}
          </select>
        </div>
      )}
    </div>
  )
}
