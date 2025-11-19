"use client"

import { useState, useEffect } from "react"
import { Button } from "@/components/ui/button"
import { ShoppingCart } from "lucide-react"
import { getCart, getCartItemCount } from "@/lib/cart"
import Link from "next/link"

export function CartDrawer() {
  const [itemCount, setItemCount] = useState(0)

  useEffect(() => {
    // Load cart count on mount
    const cart = getCart()
    setItemCount(getCartItemCount(cart))
    
    // Listen for cart updates
    const handleCartUpdate = () => {
      const cart = getCart()
      setItemCount(getCartItemCount(cart))
    }
    
    window.addEventListener('cartUpdated', handleCartUpdate)
    return () => window.removeEventListener('cartUpdated', handleCartUpdate)
  }, [])

  return (
    <Link href="/cart">
      <Button 
        variant="outline" 
        className="relative h-12 w-12 p-0 flex items-center justify-center"
      >
        <ShoppingCart className="h-8 w-8" />
        {itemCount > 0 && (
          <span className="absolute -top-2 -right-2 bg-primary text-primary-foreground rounded-full min-w-[22px] h-[22px] text-xs font-bold flex items-center justify-center px-1 animate-in zoom-in">
            {itemCount}
          </span>
        )}
      </Button>
    </Link>
  )
}
