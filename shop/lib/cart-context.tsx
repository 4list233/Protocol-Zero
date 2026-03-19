"use client"

import { createContext, useContext, useState, useEffect, useCallback, useRef, type ReactNode } from "react"
import { useAuth } from "@/lib/auth-context"

// ============ CONFIGURATION ============
export const ADDON_THRESHOLD = 30 // $30 CAD minimum cart to unlock add-on pricing

// ============ TYPES ============

export type CartItemType = "regular" | "addon"

export type CartItem = {
  // Product info
  productId: string
  productTitle: string
  productImage: string
  category?: string
  
  // Variant info
  variantId: string
  variantTitle: string
  sku?: string
  selectedOption?: string  // Selected size/color from available options (e.g., "L", "Black")
  
  // Pricing
  regularPrice: number      // Full price CAD
  addonPrice?: number       // Discounted add-on price CAD (if eligible)
  isAddonEligible: boolean  // Can this item be purchased as add-on?
  
  // Cart state
  quantity: number
  itemType: CartItemType    // Is this item being treated as add-on?
}

export type PromoCode = {
  code: string
  discount: number  // e.g., 0.10 for 10%
  isValid: boolean
}

type CartContextType = {
  // Cart items
  items: CartItem[]
  
  // Computed values
  regularSubtotal: number           // Sum of non-addon items at regular price
  addonSubtotal: number             // Sum of addon items at addon price
  subtotal: number                  // Total before promo
  promoDiscount: number             // Discount from promo code (only on non-addon items)
  total: number                     // Final total
  itemCount: number
  
  // Add-on threshold
  addonThreshold: number
  amountToUnlockAddons: number      // How much more needed to reach threshold
  addonsUnlocked: boolean           // Is cart ≥ threshold?
  
  // Promo code
  promoCode: PromoCode | null
  
  // Actions
  addItem: (item: Omit<CartItem, "quantity" | "itemType">, asAddon?: boolean) => void
  removeItem: (variantId: string) => void
  updateQuantity: (variantId: string, quantity: number) => void
  toggleAddon: (variantId: string) => void  // Switch item between regular/addon
  applyPromoCode: (code: string) => Promise<boolean>
  removePromoCode: () => void
  clearCart: () => void
  
  // Utilities
  getItemPrice: (item: CartItem) => number
  isPromoApplicable: (item: CartItem) => boolean
}

const CartContext = createContext<CartContextType | null>(null)

// ============ LOCAL STORAGE (fast offline cache) ============

const CART_KEY = "protocol-zero-cart-v2"
const PROMO_KEY = "protocol-zero-promo"

function saveCartLocal(items: CartItem[]): void {
  if (typeof window === "undefined") return
  localStorage.setItem(CART_KEY, JSON.stringify(items))
  window.dispatchEvent(new Event("cartUpdated"))
}

function loadCartLocal(): CartItem[] {
  if (typeof window === "undefined") return []
  try {
    const data = localStorage.getItem(CART_KEY)
    return data ? JSON.parse(data) : []
  } catch {
    return []
  }
}

function savePromo(promo: PromoCode | null): void {
  if (typeof window === "undefined") return
  if (promo) {
    localStorage.setItem(PROMO_KEY, JSON.stringify(promo))
  } else {
    localStorage.removeItem(PROMO_KEY)
  }
}

function loadPromo(): PromoCode | null {
  if (typeof window === "undefined") return null
  try {
    const data = localStorage.getItem(PROMO_KEY)
    return data ? JSON.parse(data) : null
  } catch {
    return null
  }
}

// ============ PROVIDER ============

export function CartProvider({ children }: { children: ReactNode }) {
  const [items, setItems] = useState<CartItem[]>([])
  const [promoCode, setPromoCode] = useState<PromoCode | null>(null)
  const [mounted, setMounted] = useState(false)
  const { user } = useAuth()
  const prevUidRef = useRef<string | null>(null)
  const mergedRef = useRef(false)

  // Load from localStorage on mount (instant display)
  useEffect(() => {
    setItems(loadCartLocal())
    setPromoCode(loadPromo())
    setMounted(true)
  }, [])

  // Save to localStorage on change (only after mount)
  useEffect(() => {
    if (mounted) {
      saveCartLocal(items)
    }
  }, [items, mounted])

  useEffect(() => {
    if (mounted) {
      savePromo(promoCode)
    }
  }, [promoCode, mounted])

  // ============ SERVER SYNC (guests + logged-in via /api/cart) ============

  // On login: merge guest cart + localStorage + server cart
  useEffect(() => {
    if (!mounted) return

    const currentUid = user?.uid || null
    const previousUid = prevUidRef.current
    prevUidRef.current = currentUid

    // User just logged in (uid changed from null → something)
    if (currentUid && !previousUid && !mergedRef.current) {
      mergedRef.current = true
      const localItems = loadCartLocal()

      user!.getIdToken().then(token =>
        fetch('/api/cart/merge', {
          method: 'POST',
          headers: {
            'Content-Type': 'application/json',
            Authorization: `Bearer ${token}`,
          },
          body: JSON.stringify({ localItems }),
        })
          .then(r => r.ok ? r.json() : null)
          .then(data => {
            if (data?.items && Array.isArray(data.items)) {
              setItems(data.items)
            }
          })
          .catch(() => {}) // keep localStorage on error
      )
      return
    }

    // User just logged out — reset merge flag, fetch guest cart
    if (!currentUid && previousUid) {
      mergedRef.current = false
      fetch('/api/cart')
        .then(r => r.ok ? r.json() : null)
        .then(data => {
          if (data?.items && Array.isArray(data.items) && data.items.length > 0) {
            setItems(data.items)
          }
        })
        .catch(() => {})
      return
    }

    // Already logged in on mount (page refresh) — load server cart
    if (currentUid && !mergedRef.current) {
      mergedRef.current = true
      user!.getIdToken().then(token =>
        fetch('/api/cart', {
          headers: { Authorization: `Bearer ${token}` },
        })
          .then(r => r.ok ? r.json() : null)
          .then(data => {
            if (data?.items && Array.isArray(data.items) && data.items.length > 0) {
              setItems(data.items)
            }
          })
          .catch(() => {})
      )
    }
  // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [user?.uid, mounted])

  // On cart change: debounce sync to /api/cart (works for both guest + logged in)
  useEffect(() => {
    if (!mounted) return

    const timer = setTimeout(() => {
      const doSync = async () => {
        const headers: Record<string, string> = {
          'Content-Type': 'application/json',
        }
        if (user) {
          const token = await user.getIdToken()
          headers['Authorization'] = `Bearer ${token}`
        }
        await fetch('/api/cart', {
          method: 'PUT',
          headers,
          body: JSON.stringify({ items }),
        }).catch(() => {})
      }

      doSync()
    }, 2000) // 2s debounce

    return () => clearTimeout(timer)
  }, [items, user, mounted])

  // ============ COMPUTED VALUES ============

  // Calculate subtotal of non-addon items at regular price
  const regularSubtotal = items
    .filter(item => item.itemType === "regular")
    .reduce((sum, item) => sum + item.regularPrice * item.quantity, 0)

  // Calculate subtotal of addon items at addon price
  const addonSubtotal = items
    .filter(item => item.itemType === "addon")
    .reduce((sum, item) => sum + (item.addonPrice || item.regularPrice) * item.quantity, 0)

  const subtotal = regularSubtotal + addonSubtotal

  // Add-on threshold calculations
  const addonsUnlocked = regularSubtotal >= ADDON_THRESHOLD
  const amountToUnlockAddons = Math.max(0, ADDON_THRESHOLD - regularSubtotal)

  // Promo discount only applies to non-addon items
  const promoDiscount = promoCode?.isValid
    ? regularSubtotal * promoCode.discount
    : 0

  const total = subtotal - promoDiscount

  const itemCount = items.reduce((sum, item) => sum + item.quantity, 0)

  // ============ HELPERS ============

  const getItemPrice = useCallback((item: CartItem): number => {
    if (item.itemType === "addon" && item.addonPrice) {
      return item.addonPrice
    }
    return item.regularPrice ?? 0
  }, [])

  const isPromoApplicable = useCallback((item: CartItem): boolean => {
    // Promo codes don't apply to add-on items
    return item.itemType === "regular"
  }, [])

  // Auto-update addon status when threshold changes
  useEffect(() => {
    if (!mounted) return
    
    setItems(currentItems => {
      let changed = false
      const updatedItems = currentItems.map(item => {
        // If addons are no longer unlocked, convert addon items back to regular
        if (!addonsUnlocked && item.itemType === "addon") {
          changed = true
          return { ...item, itemType: "regular" as CartItemType }
        }
        return item
      })
      return changed ? updatedItems : currentItems
    })
  }, [addonsUnlocked, mounted])

  // ============ ACTIONS ============

  const addItem = useCallback((
    item: Omit<CartItem, "quantity" | "itemType">,
    asAddon: boolean = false
  ) => {
    setItems(currentItems => {
      const existingIndex = currentItems.findIndex(i => i.variantId === item.variantId)
      
      if (existingIndex >= 0) {
        // Update existing item quantity
        const updated = [...currentItems]
        updated[existingIndex] = {
          ...updated[existingIndex],
          quantity: updated[existingIndex].quantity + 1,
        }
        return updated
      }
      
      // Add new item
      // Only allow as addon if eligible AND threshold is met
      const canBeAddon = item.isAddonEligible && item.addonPrice !== undefined
      const itemType: CartItemType = asAddon && canBeAddon ? "addon" : "regular"
      
      return [
        ...currentItems,
        { ...item, quantity: 1, itemType },
      ]
    })
  }, [])

  const removeItem = useCallback((variantId: string) => {
    setItems(currentItems => currentItems.filter(item => item.variantId !== variantId))
  }, [])

  const updateQuantity = useCallback((variantId: string, quantity: number) => {
    if (quantity <= 0) {
      removeItem(variantId)
      return
    }
    
    setItems(currentItems =>
      currentItems.map(item =>
        item.variantId === variantId ? { ...item, quantity } : item
      )
    )
  }, [removeItem])

  const toggleAddon = useCallback((variantId: string) => {
    setItems(currentItems =>
      currentItems.map(item => {
        if (item.variantId !== variantId) return item
        
        // Can only toggle to addon if eligible and threshold met
        if (item.itemType === "regular") {
          if (!item.isAddonEligible || !item.addonPrice) return item
          // Note: threshold check happens in useEffect
          return { ...item, itemType: "addon" as CartItemType }
        } else {
          return { ...item, itemType: "regular" as CartItemType }
        }
      })
    )
  }, [])

  const applyPromoCode = useCallback(async (code: string): Promise<boolean> => {
    const normalizedCode = code.trim().toUpperCase()
    
    if (!normalizedCode) {
      setPromoCode({
        code: normalizedCode,
        discount: 0,
        isValid: false,
      })
      return false
    }
    
    try {
      // Validate promo code against Knack database
      console.log(`[Cart] Validating promo code: ${normalizedCode}`)
      const response = await fetch(`/api/promo/validate?code=${encodeURIComponent(normalizedCode)}`)
      
      if (!response.ok) {
        console.error(`[Cart] API error: ${response.status}`)
        if (response.status >= 500) {
          // Server-side error – do not mark code as invalid, let caller handle it
          throw new Error('server_error')
        }
        setPromoCode({
          code: normalizedCode,
          discount: 0,
          isValid: false,
        })
        return false
      }
      
      const data = await response.json()
      console.log(`[Cart] API response:`, data)
      
      if (data.valid && data.discount !== undefined) {
        setPromoCode({
          code: normalizedCode,
          discount: data.discount,
          isValid: true,
        })
        return true
      } else {
        setPromoCode({
          code: normalizedCode,
          discount: 0,
          isValid: false,
        })
        return false
      }
    } catch (error) {
      console.error('[Cart] Error validating promo code:', error)
      // Re-throw server/network errors so callers can show a specific message
      throw error
    }
  }, [])

  const removePromoCode = useCallback(() => {
    setPromoCode(null)
  }, [])

  const clearCart = useCallback(() => {
    setItems([])
    setPromoCode(null)
    // Also clear server-side cart
    const doDelete = async () => {
      const headers: Record<string, string> = {}
      if (user) {
        const token = await user.getIdToken()
        headers['Authorization'] = `Bearer ${token}`
      }
      await fetch('/api/cart', { method: 'DELETE', headers }).catch(() => {})
    }
    doDelete()
  }, [user])
  
  // Validate cached promo code once after mount (in case it was deactivated in Knack)
  // Reads directly from localStorage to avoid a dependency on the `promoCode` state,
  // which would cause an infinite loop (applyPromoCode updates promoCode → effect fires again).
  useEffect(() => {
    if (!mounted) return

    const cachedPromo = loadPromo()
    if (cachedPromo && cachedPromo.isValid) {
      // Re-validate against Knack to ensure it's still active
      applyPromoCode(cachedPromo.code).catch(console.error)
    }
  }, [mounted, applyPromoCode])

  // ============ CONTEXT VALUE ============

  const value: CartContextType = {
    items,
    regularSubtotal,
    addonSubtotal,
    subtotal,
    promoDiscount,
    total,
    itemCount,
    addonThreshold: ADDON_THRESHOLD,
    amountToUnlockAddons,
    addonsUnlocked,
    promoCode,
    addItem,
    removeItem,
    updateQuantity,
    toggleAddon,
    applyPromoCode,
    removePromoCode,
    clearCart,
    getItemPrice,
    isPromoApplicable,
  }

  return (
    <CartContext.Provider value={value}>
      {children}
    </CartContext.Provider>
  )
}

// ============ HOOK ============

export function useCart() {
  const context = useContext(CartContext)
  if (!context) {
    throw new Error("useCart must be used within a CartProvider")
  }
  return context
}

