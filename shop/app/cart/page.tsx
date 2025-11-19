"use client"

import { useState, useEffect } from "react"
import { Button } from "@/components/ui/button"
import { ShoppingCart, Plus, Minus, X, ArrowLeft, ArrowRight } from "lucide-react"
import { getCart, updateQuantity, removeFromCart, getCartTotal, getCartItemCount, type CartItem } from "@/lib/cart"
import { getProductPrice } from "@/lib/pricing"
import { getProductTitle, getProductImage } from "@/lib/display-helpers"
import { getDisplayPrice } from "@/lib/products"
import Image from "next/image"
import Link from "next/link"

export default function CartPage() {
  const [cart, setCart] = useState<CartItem[]>([])

  useEffect(() => {
    // Load cart on mount
    setCart(getCart())
    
    // Listen for cart updates
    const handleCartUpdate = () => {
      setCart(getCart())
    }
    
    window.addEventListener('cartUpdated', handleCartUpdate)
    return () => window.removeEventListener('cartUpdated', handleCartUpdate)
  }, [])

  const handleUpdateQuantity = (productId: string, newQuantity: number) => {
    updateQuantity(productId, newQuantity)
    setCart(getCart())
  }

  const handleRemove = (productId: string) => {
    removeFromCart(productId)
    setCart(getCart())
  }

  const total = getCartTotal(cart)
  const itemCount = getCartItemCount(cart)

  return (
    <div className="min-h-screen bg-background">
      {/* Header */}
      <header className="sticky top-0 z-50 border-b border-border bg-background/95 backdrop-blur supports-[backdrop-filter]:bg-background/60">
        <div className="container mx-auto flex h-16 items-center justify-between px-4">
          <Link href="/" className="flex items-center gap-3 hover:opacity-80 transition-opacity">
            <img 
              src="/logos/logo-icon.png" 
              alt="Protocol Zero" 
              className="h-10 w-auto"
            />
            <span className="text-xl font-bold tracking-tight">Protocol Zero</span>
          </Link>
          <nav className="flex gap-6 items-center">
            <Link href="/" className="text-sm font-medium hover:underline">Home</Link>
            <Link href="/shop" className="text-sm font-medium hover:underline">Shop</Link>
            <Link href="/clips" className="text-sm font-medium hover:underline">Clips</Link>
          </nav>
        </div>
      </header>

      {/* Main Content */}
      <main className="container mx-auto px-4 py-8 max-w-6xl">
        <Link
          href="/shop"
          className="inline-flex items-center gap-2 text-sm text-muted-foreground hover:text-foreground mb-6"
        >
          <ArrowLeft className="h-4 w-4" />
          Continue shopping
        </Link>

        <div className="mb-8">
          <div className="inline-block">
            <h1 className="text-4xl font-bold tracking-tight mb-2 relative">
              Shopping Cart
              <div className="absolute -bottom-1 left-0 w-1/4 h-1 bg-primary/20 rounded-full"></div>
            </h1>
          </div>
          <p className="text-muted-foreground mt-3">{itemCount} {itemCount === 1 ? 'item' : 'items'} in your cart</p>
        </div>

        {cart.length === 0 ? (
          <div className="flex flex-col items-center justify-center py-16 text-center border-2 border-dashed rounded-xl">
            <ShoppingCart className="h-24 w-24 text-muted-foreground/50 mb-6" />
            <h2 className="text-2xl font-semibold mb-2">Your cart is empty</h2>
            <p className="text-muted-foreground mb-8">Add some items to get started!</p>
            <Link href="/shop">
              <Button size="lg" className="gap-2">
                Browse Products
                <ArrowRight className="h-4 w-4" />
              </Button>
            </Link>
          </div>
        ) : (
          <div className="grid lg:grid-cols-3 gap-8">
            {/* Cart Items */}
            <div className="lg:col-span-2 space-y-4">
              {cart.map((item) => (
                <div 
                  key={item.product.id} 
                  className="group flex gap-6 p-6 border-2 rounded-xl bg-card shadow-sm hover:border-primary/30 hover:shadow-md transition-all"
                >
                  {/* Product Image */}
                  <div className="relative w-32 h-32 rounded-lg overflow-hidden bg-muted flex-shrink-0 border-2 border-border group-hover:border-primary/20 transition-colors">
                    <Image
                      src={getProductImage(item.product)}
                      alt={item.product.title}
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
                          <h3 className="font-semibold text-lg mb-1 group-hover:text-primary transition-colors">{getProductTitle(item.product)}</h3>
                          {item.product.category && (
                            <p className="text-sm text-muted-foreground mb-2">{item.product.category}</p>
                          )}
                          <p className="text-sm font-medium text-primary">
                            ${getProductPrice(item.product).toFixed(2)} CAD each
                          </p>
                        </div>
                        <Button
                          variant="ghost"
                          size="icon"
                          className="h-9 w-9 text-muted-foreground hover:text-destructive hover:bg-destructive/10 rounded-full"
                          onClick={() => handleRemove(item.product.id)}
                        >
                          <X className="h-5 w-5" />
                        </Button>
                      </div>
                    </div>
                    
                    <div className="flex items-center justify-between pt-4 border-t border-border/50">
                      {/* Quantity Controls */}
                      <div className="flex items-center gap-4">
                        <span className="text-sm font-medium text-muted-foreground">Quantity:</span>
                        <div className="flex items-center gap-2">
                          <Button
                            variant="outline"
                            size="icon"
                            className="h-9 w-9 rounded-full border-2 hover:border-primary/50"
                            onClick={() => handleUpdateQuantity(item.product.id, item.quantity - 1)}
                          >
                            <Minus className="h-4 w-4" />
                          </Button>
                          <span className="text-lg font-bold w-12 text-center text-primary">{item.quantity}</span>
                          <Button
                            variant="outline"
                            size="icon"
                            className="h-9 w-9 rounded-full border-2 hover:border-primary/50"
                            onClick={() => handleUpdateQuantity(item.product.id, item.quantity + 1)}
                          >
                            <Plus className="h-4 w-4" />
                          </Button>
                        </div>
                      </div>
                      
                      {/* Item Total */}
                      <div className="text-right">
                        <p className="text-xs text-muted-foreground mb-1">Subtotal</p>
                        <p className="text-2xl font-bold text-primary">
                          ${(getProductPrice(item.product) * item.quantity).toFixed(2)}
                        </p>
                      </div>
                    </div>
                  </div>
                </div>
              ))}
            </div>

            {/* Order Summary */}
            <div className="lg:col-span-1">
              <div className="sticky top-24 border-2 rounded-xl p-6 bg-muted/30 space-y-6">
                <h2 className="text-xl font-bold">Order Summary</h2>
                
                <div className="space-y-3">
                  <div className="flex justify-between text-sm">
                    <span className="text-muted-foreground">Subtotal ({itemCount} items)</span>
                    <span className="font-medium">${total.toFixed(2)}</span>
                  </div>
                  <div className="flex justify-between text-sm">
                    <span className="text-muted-foreground">Shipping</span>
                    <span className="font-medium">Calculated at checkout</span>
                  </div>
                  <div className="flex justify-between text-sm">
                    <span className="text-muted-foreground">Tax</span>
                    <span className="font-medium">Calculated at checkout</span>
                  </div>
                  
                  <div className="border-t pt-3 mt-3">
                    <div className="flex justify-between items-baseline mb-6">
                      <span className="text-lg font-semibold">Total</span>
                      <span className="text-3xl font-bold">${total.toFixed(2)}</span>
                    </div>
                  </div>
                </div>

                <Link href="/checkout" className="block">
                  <Button className="w-full h-12 text-base font-semibold" size="lg">
                    Proceed to Checkout
                    <ArrowRight className="ml-2 h-5 w-5" />
                  </Button>
                </Link>

                <Link href="/shop" className="block">
                  <Button variant="outline" className="w-full" size="lg">
                    <ArrowLeft className="mr-2 h-4 w-4" />
                    Continue Shopping
                  </Button>
                </Link>

                <div className="pt-4 border-t text-xs text-muted-foreground space-y-2">
                  <p>✓ Secure checkout</p>
                  <p>✓ Free shipping on orders over $100</p>
                  <p>✓ 30-day return policy</p>
                </div>
              </div>
            </div>
          </div>
        )}
      </main>
    </div>
  )
}
