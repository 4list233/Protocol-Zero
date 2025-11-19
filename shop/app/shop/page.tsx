"use client"

import Link from "next/link"
import { products } from "@/lib/products"
import { getProductPrice } from "@/lib/pricing"
import { getProductTitle, getProductImage } from "@/lib/display-helpers"
import { addToCart } from "@/lib/cart"
import { CartDrawer } from "@/components/cart-drawer"
import { useToast } from "@/components/toast-provider"
import type { Product } from "@/lib/products"
import Image from "next/image"
import { ShoppingCart, ArrowLeft, Check } from "lucide-react"

export default function ShopPage() {
  const { addToast } = useToast()

  const handleAddToCart = (product: Product) => {
    addToCart(product, 1)
    
    // Show toast notification
    addToast({
      title: "Added to cart!",
      description: product.title,
      action: (
        <Link 
          href="/cart"
          className="text-sm font-medium text-primary hover:underline"
        >
          View Cart
        </Link>
      )
    })
  }

  return (
    <div className="min-h-screen bg-[#0D0D0D]">
      {/* Header */}
      <header className="sticky top-0 z-50 border-b border-[#2C2C2C] bg-[#1E1E1E]/95 backdrop-blur">
        <div className="container mx-auto flex h-16 items-center justify-between px-4">
          <Link href="/" className="flex items-center gap-3 hover:opacity-80 transition-opacity">
            <img 
              src="/logos/logo-icon.png" 
              alt="Protocol Zero" 
              className="h-10 w-auto"
            />
            <span className="text-xl font-heading font-bold tracking-wide uppercase">Protocol Zero</span>
          </Link>
          <nav className="flex gap-6 items-center">
            <Link href="/" className="text-sm font-medium hover:text-[#3D9A6C] transition-colors">Home</Link>
            <Link href="/clips" className="text-sm font-medium hover:text-[#3D9A6C] transition-colors">Clips</Link>
            <Link href="/account" className="text-sm font-medium hover:text-[#3D9A6C] transition-colors">Account</Link>
            <CartDrawer />
          </nav>
        </div>
      </header>

      {/* Main Content */}
      <main className="container mx-auto px-4 py-8">
        <Link
          href="/"
          className="inline-flex items-center gap-2 text-sm text-[#A1A1A1] hover:text-[#3D9A6C] mb-6 transition-colors"
        >
          <ArrowLeft className="h-4 w-4" />
          Back to home
        </Link>

        <div className="mb-8 space-y-2">
          <div className="inline-block">
            <h1 className="text-3xl font-heading font-bold tracking-wide uppercase md:text-4xl relative">
              Airsoft Gear & Accessories
              <div className="absolute -bottom-2 left-0 w-1/4 h-1 bg-[#3D9A6C] rounded-full"></div>
            </h1>
          </div>
          <p className="text-[#A1A1A1] font-body">Premium tactical equipment for serious players</p>
        </div>

        {/* Product Grid */}
        <div className="grid gap-6 sm:grid-cols-2 lg:grid-cols-3 xl:grid-cols-4">
          {products.map((product) => (
            <div key={product.id} className="group bg-[#1E1E1E] border-2 border-[#2C2C2C] rounded-2xl overflow-hidden hover:border-[#3D9A6C] hover:shadow-card transition-all hover:scale-[1.02]">
              <Link href={`/shop/${product.id}`} className="block">
                <div className="aspect-square relative bg-[#0D0D0D] overflow-hidden">
                  <Image
                    src={getProductImage(product)}
                    alt={product.title}
                    fill
                    className="object-cover group-hover:scale-105 transition-transform duration-300"
                    sizes="(max-width: 768px) 100vw, (max-width: 1200px) 50vw, 33vw"
                  />
                </div>
              </Link>
              <div className="p-4 space-y-3">
                <div>
                  <Link href={`/shop/${product.id}`} className="hover:opacity-90">
                    <h3 className="font-semibold font-body text-lg line-clamp-2 text-[#F5F5F5] group-hover:text-[#3D9A6C] transition-colors">{getProductTitle(product)}</h3>
                  </Link>
                  {product.options && product.options.length > 0 && (
                    <p className="text-xs text-[#3D9A6C] font-semibold mt-1">Multiple colour options available</p>
                  )}
                  {product.category && (
                    <span className="inline-block mt-2 text-xs px-3 py-1 bg-[#3D9A6C]/10 text-[#3D9A6C] rounded-full font-medium font-heading uppercase tracking-wide">
                      {product.category}
                    </span>
                  )}
                </div>
                <div className="flex items-center justify-between pt-2 border-t border-[#2C2C2C]">
                  <span className="text-2xl font-bold text-[#3D9A6C] font-mono">${getProductPrice(product).toFixed(2)}</span>
                  <span className="text-xs text-[#A1A1A1] font-mono uppercase">CAD</span>
                </div>
                <button
                  onClick={() => handleAddToCart(product)}
                  className="w-full py-2.5 px-4 bg-[#3D9A6C] text-black hover:bg-[#3D9A6C]-hover rounded-2xl font-medium font-heading uppercase tracking-wide transition-all flex items-center justify-center gap-2 hover:gap-3 hover:shadow-glow"
                >
                  <ShoppingCart className="h-4 w-4" />
                  Add to Cart
                </button>
              </div>
            </div>
          ))}
        </div>

        {products.length === 0 && (
          <div className="text-center py-12">
            <p className="text-[#A1A1A1] font-body">No products available at this time.</p>
          </div>
        )}
      </main>
    </div>
  )
}
