"use client"

import { Card } from "@/components/ui/card"
import { Button } from "@/components/ui/button"
import { ShoppingCart } from "lucide-react"
import type { Product } from "@/lib/products"
import { getProductPrice } from "@/lib/pricing"
import { getProductImage, getProductTitle } from "@/lib/display-helpers"
import Image from "next/image"
import Link from "next/link"

type ProductCardProps = {
  product: Product
  onAddToCart: (product: Product) => void
}

export function ProductCard({ product, onAddToCart }: ProductCardProps) {
  return (
    <Link href={`/shop/${product.id}`} passHref legacyBehavior>
      <a style={{ textDecoration: 'none' }}>
        <Card className="overflow-hidden hover:shadow-lg transition-shadow cursor-pointer group">
          <div className="aspect-square relative bg-muted">
            <Image
              src={getProductImage(product)}
              alt={getProductTitle(product)}
              fill
              className="object-cover group-hover:scale-105 transition-transform duration-300"
              sizes="(max-width: 768px) 100vw, (max-width: 1200px) 50vw, 33vw"
            />
          </div>
          <div className="p-4 space-y-3">
            <div>
              <h3 className="font-semibold text-lg line-clamp-2">{getProductTitle(product)}</h3>
              {/* Show note if there are options for colour selection */}
              {product.options && product.options.length > 0 && (
                <p className="text-xs text-[#3D9A6C] font-semibold mt-1">Multiple colour options available</p>
              )}
            </div>
            <div className="flex items-center justify-between">
              <span className="text-2xl font-bold">${getProductPrice(product).toFixed(2)}</span>
              <span className="text-xs text-muted-foreground">CAD</span>
            </div>
            <Button 
              onClick={e => {
                e.preventDefault(); // Prevent link navigation
                onAddToCart(product)
              }}
              className="w-full gap-2"
              size="lg"
            >
              <ShoppingCart className="h-4 w-4" />
              Add to Cart
            </Button>
          </div>
        </Card>
      </a>
    </Link>
  )
}
