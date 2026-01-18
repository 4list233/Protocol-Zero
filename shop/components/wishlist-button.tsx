"use client"

import { useState, useEffect } from "react"
import { Heart } from "lucide-react"
import { addToWishlist, removeFromWishlist, isInWishlist } from "@/lib/wishlist"
import { useToast } from "@/components/toast-provider"

interface WishlistButtonProps {
  productId: string
  productTitle: string
  className?: string
  showLabel?: boolean
}

export function WishlistButton({ productId, productTitle, className = "", showLabel = false }: WishlistButtonProps) {
  const [isWishlisted, setIsWishlisted] = useState(false)
  const { addToast } = useToast()

  useEffect(() => {
    setIsWishlisted(isInWishlist(productId))

    const handleWishlistUpdate = (e: Event) => {
      const customEvent = e as CustomEvent
      if (customEvent.detail?.added === productId || customEvent.detail?.removed === productId) {
        setIsWishlisted(isInWishlist(productId))
      }
    }

    window.addEventListener("wishlistUpdated", handleWishlistUpdate)
    return () => window.removeEventListener("wishlistUpdated", handleWishlistUpdate)
  }, [productId])

  const toggleWishlist = (e: React.MouseEvent) => {
    e.preventDefault()
    e.stopPropagation()

    if (isWishlisted) {
      removeFromWishlist(productId)
      addToast({
        title: "Removed from wishlist",
        description: `${productTitle} removed from your wishlist`
      })
    } else {
      addToWishlist(productId)
      addToast({
        title: "Added to wishlist",
        description: `${productTitle} added to your wishlist`
      })
    }
  }

  return (
    <button
      onClick={toggleWishlist}
      className={`group flex items-center gap-2 p-2 rounded-full transition-all ${
        isWishlisted
          ? "text-red-500 hover:text-red-600"
          : "text-[#A1A1A1] hover:text-red-500"
      } ${className}`}
      aria-label={isWishlisted ? "Remove from wishlist" : "Add to wishlist"}
    >
      <Heart 
        className={`h-5 w-5 transition-all ${isWishlisted ? "fill-current" : ""}`}
      />
      {showLabel && (
        <span className="text-sm font-medium">
          {isWishlisted ? "Wishlisted" : "Add to Wishlist"}
        </span>
      )}
    </button>
  )
}
