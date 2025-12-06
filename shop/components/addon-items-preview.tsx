"use client"

import { useState, useEffect } from "react"
import Image from "next/image"
import { Button } from "@/components/ui/button"
import { useCart, ADDON_THRESHOLD } from "@/lib/cart-context"
import { Plus, Sparkles, ChevronDown, ChevronUp, Tag } from "lucide-react"

type AddonItem = {
  productId: string
  productTitle: string
  productImage: string
  variantId: string
  variantTitle: string
  sku?: string
  regularPrice: number
  addonPrice: number
  savings: number
  savingsPercent: number
}

type AddonItemsPreviewProps = {
  addonItems?: AddonItem[]
  compact?: boolean
}

export function AddonItemsPreview({ addonItems = [], compact = false }: AddonItemsPreviewProps) {
  const { addonsUnlocked, amountToUnlockAddons, addItem, items } = useCart()
  const [isExpanded, setIsExpanded] = useState(false)
  
  // Filter out items already in cart
  const availableAddons = addonItems.filter(
    addon => !items.some(item => item.variantId === addon.variantId)
  )
  
  if (availableAddons.length === 0) return null

  const handleAddAsAddon = (addon: AddonItem) => {
    addItem({
      productId: addon.productId,
      productTitle: addon.productTitle,
      productImage: addon.productImage,
      variantId: addon.variantId,
      variantTitle: addon.variantTitle,
      sku: addon.sku,
      regularPrice: addon.regularPrice,
      addonPrice: addon.addonPrice,
      isAddonEligible: true,
    }, addonsUnlocked) // Add as addon if unlocked
  }

  // Compact version for cart drawer
  if (compact) {
    return (
      <div className="bg-gradient-to-r from-[#3D9A6C]/10 to-[#3D9A6C]/5 rounded-lg p-4 border border-[#3D9A6C]/20">
        {!addonsUnlocked ? (
          <div className="flex items-center gap-2">
            <Tag className="h-4 w-4 text-[#3D9A6C]" />
            <p className="text-sm text-[#A1A1A1]">
              Add <span className="font-semibold text-[#3D9A6C]">${amountToUnlockAddons.toFixed(2)}</span> more 
              to unlock discounts on {availableAddons.length} items!
            </p>
          </div>
        ) : (
          <div className="flex items-center gap-2">
            <Sparkles className="h-4 w-4 text-[#3D9A6C]" />
            <p className="text-sm text-[#F5F5F5]">
              <span className="font-semibold">{availableAddons.length} add-on deals</span> unlocked!
            </p>
          </div>
        )}
      </div>
    )
  }

  // Full version for cart page
  return (
    <div className="bg-gradient-to-br from-[#1C1C1C] to-[#0F0F0F] rounded-xl border border-[#3D9A6C]/30 overflow-hidden">
      {/* Header */}
      <div className="p-4 bg-gradient-to-r from-[#3D9A6C]/20 to-transparent border-b border-[#3D9A6C]/20">
        <div className="flex items-center justify-between">
          <div className="flex items-center gap-3">
            <div className="h-10 w-10 rounded-full bg-[#3D9A6C]/20 flex items-center justify-center">
              <Sparkles className="h-5 w-5 text-[#3D9A6C]" />
            </div>
            <div>
              {addonsUnlocked ? (
                <>
                  <h3 className="font-semibold text-[#F5F5F5]">Add-on Deals Unlocked! 🎉</h3>
                  <p className="text-sm text-[#A1A1A1]">
                    Add these items at special prices
                  </p>
                </>
              ) : (
                <>
                  <h3 className="font-semibold text-[#F5F5F5]">
                    Add ${amountToUnlockAddons.toFixed(2)} more to unlock deals
                  </h3>
                  <p className="text-sm text-[#A1A1A1]">
                    Get {availableAddons.length} items at special add-on prices
                  </p>
                </>
              )}
            </div>
          </div>
          <Button
            variant="ghost"
            size="sm"
            onClick={() => setIsExpanded(!isExpanded)}
            className="text-[#3D9A6C] hover:bg-[#3D9A6C]/10"
          >
            {isExpanded ? (
              <>Hide <ChevronUp className="ml-1 h-4 w-4" /></>
            ) : (
              <>View {availableAddons.length} items <ChevronDown className="ml-1 h-4 w-4" /></>
            )}
          </Button>
        </div>
        
        {/* Progress bar to threshold */}
        {!addonsUnlocked && (
          <div className="mt-3">
            <div className="h-2 bg-[#0A0A0A] rounded-full overflow-hidden">
              <div 
                className="h-full bg-gradient-to-r from-[#3D9A6C] to-[#4CAF50] transition-all duration-500"
                style={{ width: `${Math.min(100, ((ADDON_THRESHOLD - amountToUnlockAddons) / ADDON_THRESHOLD) * 100)}%` }}
              />
            </div>
            <p className="text-xs text-[#A1A1A1] mt-1 text-right">
              ${(ADDON_THRESHOLD - amountToUnlockAddons).toFixed(2)} / ${ADDON_THRESHOLD} to unlock
            </p>
          </div>
        )}
      </div>

      {/* Items grid */}
      {isExpanded && (
        <div className="p-4">
          <div className="grid grid-cols-2 md:grid-cols-3 lg:grid-cols-4 gap-3">
            {availableAddons.slice(0, 8).map((addon) => (
              <div
                key={addon.variantId}
                className="bg-[#0A0A0A] rounded-lg border border-[#2C2C2C] p-3 hover:border-[#3D9A6C]/50 transition-colors"
              >
                {/* Image */}
                <div className="relative aspect-square rounded-md overflow-hidden bg-[#1C1C1C] mb-2">
                  <Image
                    src={addon.productImage}
                    alt={addon.productTitle}
                    fill
                    className="object-cover"
                    sizes="150px"
                  />
                  {/* Savings badge */}
                  <div className="absolute top-1 right-1 bg-[#3D9A6C] text-black text-xs font-bold px-1.5 py-0.5 rounded">
                    -{addon.savingsPercent}%
                  </div>
                </div>
                
                {/* Info */}
                <div className="space-y-1">
                  <p className="text-xs text-[#A1A1A1] truncate">{addon.productTitle}</p>
                  <p className="text-sm font-medium text-[#F5F5F5] truncate">{addon.variantTitle}</p>
                  
                  {/* Pricing */}
                  <div className="flex items-center gap-2">
                    <span className="text-sm font-bold text-[#3D9A6C]">
                      ${addon.addonPrice.toFixed(2)}
                    </span>
                    <span className="text-xs text-[#666] line-through">
                      ${addon.regularPrice.toFixed(2)}
                    </span>
                  </div>
                </div>
                
                {/* Add button */}
                <Button
                  size="sm"
                  className={`w-full mt-2 ${
                    addonsUnlocked
                      ? "bg-[#3D9A6C] hover:bg-[#2D8A5C] text-black"
                      : "bg-[#2C2C2C] hover:bg-[#3C3C3C] text-[#A1A1A1]"
                  }`}
                  onClick={() => handleAddAsAddon(addon)}
                >
                  <Plus className="h-3 w-3 mr-1" />
                  {addonsUnlocked ? "Add" : "Add (full price)"}
                </Button>
              </div>
            ))}
          </div>
          
          {availableAddons.length > 8 && (
            <p className="text-center text-sm text-[#A1A1A1] mt-3">
              +{availableAddons.length - 8} more add-on items available
            </p>
          )}
        </div>
      )}
    </div>
  )
}

// Badge component for showing add-on status in cart items
export function AddonBadge({ isAddon, savings }: { isAddon: boolean; savings?: number }) {
  if (!isAddon) return null
  
  return (
    <div className="inline-flex items-center gap-1 bg-[#3D9A6C]/20 text-[#3D9A6C] text-xs font-medium px-2 py-0.5 rounded-full">
      <Sparkles className="h-3 w-3" />
      Add-on deal
      {savings && savings > 0 && (
        <span className="text-[#3D9A6C]/70">(-${savings.toFixed(2)})</span>
      )}
    </div>
  )
}

// Warning banner for promo code section
export function PromoExcludesAddonsNotice() {
  return (
    <div className="flex items-start gap-2 bg-yellow-500/10 border border-yellow-500/30 rounded-lg p-3">
      <Tag className="h-4 w-4 text-yellow-500 flex-shrink-0 mt-0.5" />
      <p className="text-xs text-yellow-400">
        <strong>Note:</strong> Promo codes do not apply to add-on items as they are already discounted.
      </p>
    </div>
  )
}

