"use client"

import { useEffect, useState } from "react"
import Image from "next/image"
import { ShoppingCart } from "lucide-react"

interface FlyingProduct {
  id: string
  image: string
  startX: number
  startY: number
}

export function useAddToCartAnimation() {
  const [flyingProducts, setFlyingProducts] = useState<FlyingProduct[]>([])

  const triggerAnimation = (productImage: string, buttonElement: HTMLElement) => {
    const rect = buttonElement.getBoundingClientRect()
    
    const flyingProduct: FlyingProduct = {
      id: Date.now().toString(),
      image: productImage,
      startX: rect.left + rect.width / 2,
      startY: rect.top + rect.height / 2,
    }

    setFlyingProducts(prev => [...prev, flyingProduct])

    // Remove after animation completes
    setTimeout(() => {
      setFlyingProducts(prev => prev.filter(p => p.id !== flyingProduct.id))
    }, 1000)
  }

  return { flyingProducts, triggerAnimation }
}

interface AddToCartAnimationProps {
  flyingProducts: FlyingProduct[]
}

export function AddToCartAnimation({ flyingProducts }: AddToCartAnimationProps) {
  return (
    <>
      {flyingProducts.map(product => (
        <FlyingProductImage
          key={product.id}
          image={product.image}
          startX={product.startX}
          startY={product.startY}
        />
      ))}
    </>
  )
}

function FlyingProductImage({ image, startX, startY }: { image: string; startX: number; startY: number }) {
  const [cartPosition, setCartPosition] = useState({ x: 0, y: 0 })

  useEffect(() => {
    // Find cart icon position
    const cartIcon = document.querySelector('[data-cart-icon]') as HTMLElement
    if (cartIcon) {
      const rect = cartIcon.getBoundingClientRect()
      setCartPosition({
        x: rect.left + rect.width / 2,
        y: rect.top + rect.height / 2,
      })
    }
  }, [])

  return (
    <div
      className="fixed z-[9999] pointer-events-none"
      style={{
        left: `${startX}px`,
        top: `${startY}px`,
        animation: "flyToCart 1s ease-in-out forwards",
        "--end-x": `${cartPosition.x - startX}px`,
        "--end-y": `${cartPosition.y - startY}px`,
      } as React.CSSProperties}
    >
      <div className="relative w-16 h-16 rounded-lg overflow-hidden border-2 border-[#3D9A6C] shadow-glow animate-pulse">
        <Image
          src={image}
          alt="Product"
          fill
          className="object-cover"
        />
      </div>
      <style jsx>{`
        @keyframes flyToCart {
          0% {
            transform: translate(0, 0) scale(1);
            opacity: 1;
          }
          50% {
            transform: translate(calc(var(--end-x) * 0.5), calc(var(--end-y) * 0.5 - 50px)) scale(0.8);
            opacity: 0.8;
          }
          100% {
            transform: translate(var(--end-x), var(--end-y)) scale(0.1);
            opacity: 0;
          }
        }
      `}</style>
    </div>
  )
}
