"use client"

import { useState, useEffect } from "react"
import { Button } from "@/components/ui/button"
import { ShoppingCart, Plus, Minus, X, ArrowLeft, ArrowRight, Sparkles, RefreshCw } from "lucide-react"
import { useCart, ADDON_THRESHOLD } from "@/lib/cart-context"
import { AddonItemsPreview, AddonBadge } from "@/components/addon-items-preview"
import Image from "next/image"
import Link from "next/link"

// Prevent static generation - cart requires client-side context and localStorage
export const dynamic = 'force-dynamic'

type AddonItemData = {
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

export default function CartPage() {
  const {
    items,
    regularSubtotal,
    addonSubtotal,
    subtotal,
    total,
    itemCount,
    addonsUnlocked,
    amountToUnlockAddons,
    updateQuantity,
    removeItem,
    toggleAddon,
    getItemPrice,
  } = useCart()

  const [addonItems, setAddonItems] = useState<AddonItemData[]>([])
  const [loadingAddons, setLoadingAddons] = useState(true)

  // Fetch addon items
  useEffect(() => {
    async function fetchAddons() {
      try {
        const res = await fetch('/api/addons')
        if (res.ok) {
          const data = await res.json()
          setAddonItems(data.items || [])
        }
      } catch (error) {
        console.error('Failed to fetch addons:', error)
      } finally {
        setLoadingAddons(false)
      }
    }
    fetchAddons()
  }, [])

  return (
    <div className="min-h-screen bg-[#0A0A0A]">
      {/* Header */}
      <header className="sticky top-0 z-50 border-b border-[#1C1C1C] bg-[#0A0A0A]/95 backdrop-blur supports-[backdrop-filter]:bg-[#0A0A0A]/60">
        <div className="container mx-auto flex h-16 items-center justify-between px-4">
          <Link href="/" className="flex items-center gap-3 hover:opacity-80 transition-opacity">
            <img 
              src="/logos/logo-icon.png" 
              alt="Protocol Zero" 
              className="h-10 w-auto"
            />
            <span className="text-xl font-bold tracking-tight text-[#F5F5F5]">Protocol Zero</span>
          </Link>
          <nav className="flex gap-6 items-center">
            <Link href="/" className="text-sm font-medium text-[#A1A1A1] hover:text-[#F5F5F5]">Home</Link>
            <Link href="/shop" className="text-sm font-medium text-[#A1A1A1] hover:text-[#F5F5F5]">Shop</Link>
            <Link href="/clips" className="text-sm font-medium text-[#A1A1A1] hover:text-[#F5F5F5]">Clips</Link>
          </nav>
        </div>
      </header>

      {/* Main Content */}
      <main className="container mx-auto px-4 py-8 max-w-6xl">
        <Link
          href="/shop"
          className="inline-flex items-center gap-2 text-sm text-[#A1A1A1] hover:text-[#F5F5F5] mb-6"
        >
          <ArrowLeft className="h-4 w-4" />
          Continue shopping
        </Link>

        <div className="mb-8">
          <div className="inline-block">
            <h1 className="text-4xl font-bold tracking-tight text-[#F5F5F5] mb-2 relative">
              Shopping Cart
              <div className="absolute -bottom-1 left-0 w-1/4 h-1 bg-[#3D9A6C]/20 rounded-full"></div>
            </h1>
          </div>
          <p className="text-[#A1A1A1] mt-3">{itemCount} {itemCount === 1 ? 'item' : 'items'} in your cart</p>
        </div>

        {items.length === 0 ? (
          <div className="flex flex-col items-center justify-center py-16 text-center border-2 border-dashed border-[#2C2C2C] rounded-xl">
            <ShoppingCart className="h-24 w-24 text-[#3C3C3C] mb-6" />
            <h2 className="text-2xl font-semibold text-[#F5F5F5] mb-2">Your cart is empty</h2>
            <p className="text-[#A1A1A1] mb-8">Add some items to get started!</p>
            <Link href="/shop">
              <Button size="lg" className="gap-2 bg-[#3D9A6C] hover:bg-[#2D8A5C]">
                Browse Products
                <ArrowRight className="h-4 w-4" />
              </Button>
            </Link>
          </div>
        ) : (
          <div className="grid lg:grid-cols-3 gap-8">
            {/* Cart Items */}
            <div className="lg:col-span-2 space-y-4">
              {/* Add-on threshold banner */}
              {!addonsUnlocked && addonItems.length > 0 && (
                <div className="bg-gradient-to-r from-[#3D9A6C]/10 to-transparent border border-[#3D9A6C]/30 rounded-xl p-4">
                  <div className="flex items-center gap-3">
                    <div className="h-10 w-10 rounded-full bg-[#3D9A6C]/20 flex items-center justify-center flex-shrink-0">
                      <Sparkles className="h-5 w-5 text-[#3D9A6C]" />
                    </div>
                    <div className="flex-1">
                      <p className="text-[#F5F5F5] font-medium">
                        Add <span className="text-[#3D9A6C] font-bold">${amountToUnlockAddons.toFixed(2)}</span> more to unlock add-on deals!
                      </p>
                      <p className="text-sm text-[#A1A1A1]">
                        Get {addonItems.length} items at special discounted prices
                      </p>
                    </div>
                  </div>
                  {/* Progress bar */}
                  <div className="mt-3">
                    <div className="h-2 bg-[#1C1C1C] rounded-full overflow-hidden">
                      <div 
                        className="h-full bg-gradient-to-r from-[#3D9A6C] to-[#4CAF50] transition-all duration-500"
                        style={{ width: `${Math.min(100, ((ADDON_THRESHOLD - amountToUnlockAddons) / ADDON_THRESHOLD) * 100)}%` }}
                      />
                    </div>
                  </div>
                </div>
              )}

              {/* Unlocked banner */}
              {addonsUnlocked && addonItems.length > 0 && (
                <div className="bg-gradient-to-r from-[#3D9A6C]/20 to-transparent border border-[#3D9A6C]/30 rounded-xl p-4">
                  <div className="flex items-center gap-3">
                    <div className="h-10 w-10 rounded-full bg-[#3D9A6C]/30 flex items-center justify-center flex-shrink-0">
                      <Sparkles className="h-5 w-5 text-[#3D9A6C]" />
                    </div>
                    <div>
                      <p className="text-[#3D9A6C] font-semibold">🎉 Add-on deals unlocked!</p>
                      <p className="text-sm text-[#A1A1A1]">
                        You can now add items below at special prices
                      </p>
                    </div>
                  </div>
                </div>
              )}

              {/* Cart items */}
              {items.map((item) => {
                const itemPrice = getItemPrice(item)
                const isAddon = item.itemType === "addon"
                const savings = isAddon && item.addonPrice ? item.regularPrice - item.addonPrice : 0
                
                return (
                  <div 
                    key={item.variantId} 
                    className={`group flex gap-6 p-6 border-2 rounded-xl bg-[#1C1C1C] shadow-sm transition-all ${
                      isAddon 
                        ? 'border-[#3D9A6C]/50 bg-gradient-to-r from-[#3D9A6C]/5 to-transparent' 
                        : 'border-[#2C2C2C] hover:border-[#3D9A6C]/30'
                    }`}
                  >
                    {/* Product Image */}
                    <div className="relative w-32 h-32 rounded-lg overflow-hidden bg-[#0A0A0A] flex-shrink-0 border-2 border-[#2C2C2C] group-hover:border-[#3D9A6C]/20 transition-colors">
                      <Image
                        src={item.productImage}
                        alt={item.productTitle}
                        fill
                        className="object-cover group-hover:scale-105 transition-transform duration-300"
                        sizes="128px"
                      />
                    </div>
                    
                    {/* Product Details */}
                    <div className="flex-1 flex flex-col justify-between">
                      <div>
                        <div className="flex justify-between items-start mb-2">
                          <div>
                            <h3 className="font-semibold text-lg text-[#F5F5F5] mb-1 group-hover:text-[#3D9A6C] transition-colors">
                              {item.productTitle}
                            </h3>
                            {item.variantTitle && (
                              <p className="text-sm font-medium text-[#3D9A6C]/80 mb-1">
                                {item.variantTitle}
                              </p>
                            )}
                            {item.category && (
                              <p className="text-sm text-[#A1A1A1] mb-2">{item.category}</p>
                            )}
                            
                            {/* Add-on badge */}
                            <AddonBadge isAddon={isAddon} savings={savings} />
                            
                            {/* Pricing */}
                            <div className="flex items-center gap-2 mt-2">
                              <span className="text-sm font-medium text-[#3D9A6C]">
                                ${itemPrice.toFixed(2)} CAD each
                              </span>
                              {isAddon && (
                                <span className="text-sm text-[#666] line-through">
                                  ${item.regularPrice.toFixed(2)}
                                </span>
                              )}
                            </div>
                          </div>
                          <Button
                            variant="ghost"
                            size="icon"
                            className="h-9 w-9 text-[#A1A1A1] hover:text-red-500 hover:bg-red-500/10 rounded-full"
                            onClick={() => removeItem(item.variantId)}
                          >
                            <X className="h-5 w-5" />
                          </Button>
                        </div>
                      </div>
                      
                      <div className="flex items-center justify-between pt-4 border-t border-[#2C2C2C]/50">
                        {/* Quantity Controls */}
                        <div className="flex items-center gap-4">
                          <span className="text-sm font-medium text-[#A1A1A1]">Quantity:</span>
                          <div className="flex items-center gap-2">
                            <Button
                              variant="outline"
                              size="icon"
                              className="h-9 w-9 rounded-full border-2 border-[#2C2C2C] hover:border-[#3D9A6C]/50 bg-transparent text-[#A1A1A1]"
                              onClick={() => updateQuantity(item.variantId, item.quantity - 1)}
                            >
                              <Minus className="h-4 w-4" />
                            </Button>
                            <span className="text-lg font-bold w-12 text-center text-[#3D9A6C]">{item.quantity}</span>
                            <Button
                              variant="outline"
                              size="icon"
                              className="h-9 w-9 rounded-full border-2 border-[#2C2C2C] hover:border-[#3D9A6C]/50 bg-transparent text-[#A1A1A1]"
                              onClick={() => updateQuantity(item.variantId, item.quantity + 1)}
                            >
                              <Plus className="h-4 w-4" />
                            </Button>
                          </div>
                        </div>
                        
                        {/* Toggle add-on button */}
                        {item.isAddonEligible && item.addonPrice && addonsUnlocked && (
                          <Button
                            variant="ghost"
                            size="sm"
                            className={`text-xs ${isAddon ? 'text-[#A1A1A1]' : 'text-[#3D9A6C]'}`}
                            onClick={() => toggleAddon(item.variantId)}
                          >
                            <RefreshCw className="h-3 w-3 mr-1" />
                            {isAddon ? 'Use regular price' : 'Apply add-on price'}
                          </Button>
                        )}
                        
                        {/* Item Total */}
                        <div className="text-right">
                          <p className="text-xs text-[#A1A1A1] mb-1">Subtotal</p>
                          <p className="text-2xl font-bold text-[#3D9A6C]">
                            ${(itemPrice * item.quantity).toFixed(2)}
                          </p>
                        </div>
                      </div>
                    </div>
                  </div>
                )
              })}

              {/* Add-on items preview */}
              {!loadingAddons && addonItems.length > 0 && (
                <AddonItemsPreview addonItems={addonItems} />
              )}
            </div>

            {/* Order Summary */}
            <div className="lg:col-span-1">
              <div className="sticky top-24 border-2 border-[#2C2C2C] rounded-xl p-6 bg-[#1C1C1C] space-y-6">
                <h2 className="text-xl font-bold text-[#F5F5F5]">Order Summary</h2>
                
                <div className="space-y-3">
                  {/* Regular items subtotal */}
                  <div className="flex justify-between text-sm">
                    <span className="text-[#A1A1A1]">Regular items</span>
                    <span className="font-medium text-[#F5F5F5]">${regularSubtotal.toFixed(2)}</span>
                  </div>
                  
                  {/* Add-on items subtotal */}
                  {addonSubtotal > 0 && (
                    <div className="flex justify-between text-sm">
                      <span className="text-[#A1A1A1] flex items-center gap-1">
                        <Sparkles className="h-3 w-3 text-[#3D9A6C]" />
                        Add-on items
                      </span>
                      <span className="font-medium text-[#3D9A6C]">${addonSubtotal.toFixed(2)}</span>
                    </div>
                  )}
                  
                  <div className="flex justify-between text-sm">
                    <span className="text-[#A1A1A1]">Subtotal ({itemCount} items)</span>
                    <span className="font-medium text-[#F5F5F5]">${subtotal.toFixed(2)}</span>
                  </div>
                  <div className="flex justify-between text-sm">
                    <span className="text-[#A1A1A1]">Shipping</span>
                    <span className="font-medium text-[#A1A1A1]">Calculated at checkout</span>
                  </div>
                  
                  <div className="border-t border-[#2C2C2C] pt-3 mt-3">
                    <div className="flex justify-between items-baseline mb-6">
                      <span className="text-lg font-semibold text-[#F5F5F5]">Total</span>
                      <span className="text-3xl font-bold text-[#3D9A6C]">${total.toFixed(2)}</span>
                    </div>
                  </div>
                </div>

                <Link href="/checkout" className="block">
                  <Button className="w-full h-12 text-base font-semibold bg-[#3D9A6C] hover:bg-[#2D8A5C]" size="lg">
                    Proceed to Checkout
                    <ArrowRight className="ml-2 h-5 w-5" />
                  </Button>
                </Link>

                <Link href="/shop" className="block">
                  <Button variant="outline" className="w-full border-[#2C2C2C] text-[#A1A1A1] hover:text-[#F5F5F5] hover:border-[#3D9A6C]/50" size="lg">
                    <ArrowLeft className="mr-2 h-4 w-4" />
                    Continue Shopping
                  </Button>
                </Link>

                <div className="pt-4 border-t border-[#2C2C2C] text-xs text-[#A1A1A1] space-y-2">
                  <p>✓ Free shipping</p>
                  <p>✓ Orders will be delivered in the middle and by the end of each month</p>
                  <p>✓ All prices are reflected with HST included</p>
                </div>
              </div>
            </div>
          </div>
        )}
      </main>
    </div>
  )
}
