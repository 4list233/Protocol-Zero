"use client"

import { Button } from "@/components/ui/button"
import { ShoppingCart } from "lucide-react"
import { useCart } from "@/lib/cart-context"
import Link from "next/link"

export function CartDrawer() {
  const { itemCount } = useCart()

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
