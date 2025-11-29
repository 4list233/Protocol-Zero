"use client"

import Image from "next/image"
import type { CartItem } from "@/lib/cart"

type CheckoutSummaryProps = {
  cart: CartItem[]
}

export function CheckoutSummary({ cart }: CheckoutSummaryProps) {
  const subtotal = cart.reduce((sum, item) => sum + (item.product.price_cad * item.quantity), 0)

  return (
    <div className="bg-[#1C1C1C] rounded-lg border border-[#2C2C2C] p-6">
      <h3 className="font-semibold text-lg text-[#F5F5F5] mb-4">Order Summary</h3>
      <div className="space-y-4">
        {cart.map((item, idx) => (
          <div key={`${item.product.id}-${item.product.selectedVariantId || idx}`} className="flex gap-4">
            {/* Product Image */}
            <div className="w-16 h-16 bg-[#0A0A0A] rounded overflow-hidden flex-shrink-0">
              <Image
                src={item.product.primaryImage || '/images/placeholder.png'}
                alt={item.product.title}
                width={64}
                height={64}
                className="w-full h-full object-cover"
              />
            </div>
            
            {/* Product Details */}
            <div className="flex-1 min-w-0">
              <p className="font-medium text-[#F5F5F5] text-sm truncate">{item.product.title}</p>
              {item.product.selectedVariantTitle && (
                <p className="text-[#3D9A6C] text-xs font-medium">{item.product.selectedVariantTitle}</p>
              )}
              <p className="text-[#A1A1A1] text-xs">Qty: {item.quantity}</p>
            </div>
            
            {/* Price */}
            <div className="text-right flex-shrink-0">
              <p className="font-medium text-[#F5F5F5]">${(item.product.price_cad * item.quantity).toFixed(2)}</p>
            </div>
          </div>
        ))}
      </div>
      
      <div className="border-t border-[#2C2C2C] mt-4 pt-4 space-y-2">
        <div className="flex justify-between text-sm text-[#A1A1A1]">
          <span>Subtotal</span>
          <span>${subtotal.toFixed(2)}</span>
        </div>
        <div className="flex justify-between text-sm text-[#A1A1A1]">
          <span>Shipping</span>
          <span className="text-[#3D9A6C]">Free</span>
        </div>
        <div className="flex justify-between font-bold text-lg text-[#F5F5F5] pt-2 border-t border-[#2C2C2C]">
          <span>Total</span>
          <span className="text-[#3D9A6C]">${subtotal.toFixed(2)} CAD</span>
        </div>
      </div>
    </div>
  )
}
