"use client"

import type { CartItem } from "@/lib/cart"

type CheckoutSummaryProps = {
  cart: CartItem[]
}

export function CheckoutSummary({ cart }: CheckoutSummaryProps) {
  const subtotal = cart.reduce((sum, item) => sum + (item.product.price_cad * item.quantity), 0)

  return (
    <div className="space-y-4">
      <h3 className="font-semibold text-lg">Order Summary</h3>
      <div className="space-y-3">
        {cart.map((item) => (
          <div key={item.product.id} className="flex justify-between text-sm">
            <div className="flex-1">
              <p className="font-medium">{item.product.title}</p>
              {item.product.category && (
                <p className="text-muted-foreground text-xs">Category: {item.product.category}</p>
              )}
              <p className="text-muted-foreground text-xs">Qty: {item.quantity}</p>
            </div>
            <div className="text-right">
              <p className="font-medium">${(item.product.price_cad * item.quantity).toFixed(2)}</p>
            </div>
          </div>
        ))}
      </div>
      <div className="border-t pt-4">
        <div className="flex justify-between font-bold text-lg">
          <span>Total:</span>
          <span>${subtotal.toFixed(2)} CAD</span>
        </div>
      </div>
    </div>
  )
}
