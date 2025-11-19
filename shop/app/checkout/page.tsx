"use client"

import { useState, useEffect } from "react"
import Link from "next/link"
import { Button } from "@/components/ui/button"
import { Input } from "@/components/ui/input"
import { CheckoutSummary } from "@/components/checkout-summary"
import { CopyButton } from "@/components/copy-button"
import { type CartItem, getCart, getCartTotal, clearCart, generateOrderId } from "@/lib/cart"
import { STORE_EMAIL, PICKUP_LOCATION, SECURITY_QUESTION, SECURITY_ANSWER } from "@/lib/constants"
import { ArrowLeft, Mail } from "lucide-react"
import { useRouter } from "next/navigation"

export default function CheckoutPage() {
  const [cart, setCart] = useState<CartItem[]>([])
  const [orderId, setOrderId] = useState("")
  const [customerName, setCustomerName] = useState("")
  const [customerEmail, setCustomerEmail] = useState("")
  const [customerPhone, setCustomerPhone] = useState("")
  const router = useRouter()

  useEffect(() => {
    const currentCart = getCart()
    setCart(currentCart)
    setOrderId(generateOrderId())

    if (currentCart.length === 0) {
      router.push("/")
    }
  }, [router])

  const total = getCartTotal(cart)

  const generateEmailBody = () => {
    let body = `Order Details:\n\n`
    cart.forEach((item) => {
      const lineTotal = item.product.price_cad * item.quantity
      body += `${item.product.title}\n`
      body += `SKU: ${item.product.sku}\n`
      body += `Quantity: ${item.quantity} × $${item.product.price_cad.toFixed(2)} = $${lineTotal.toFixed(2)} CAD\n\n`
    })
    body += `---\n`
    body += `Subtotal (Grand Total): $${total.toFixed(2)} CAD\n\n`

    if (customerName || customerEmail || customerPhone) {
      body += `Customer Information:\n`
      if (customerName) body += `Name: ${customerName}\n`
      if (customerEmail) body += `Email: ${customerEmail}\n`
      if (customerPhone) body += `Phone: ${customerPhone}\n`
      body += `\n`
    }

    body += `Pickup Location: ${PICKUP_LOCATION}\n\n`
    body += `Payment Instructions:\n`
    body += `Please send Interac e-Transfer to: ${STORE_EMAIL}\n`
    body += `Security Question: ${SECURITY_QUESTION}\n`
    body += `Answer: ${SECURITY_ANSWER}\n`
    body += `Amount: $${total.toFixed(2)} CAD\n`
    body += `Memo: Order ${orderId}`

    return body
  }

  const handlePlaceOrder = () => {
    const subject = `Order ${orderId}`
    const body = encodeURIComponent(generateEmailBody())
    const mailtoLink = `mailto:${STORE_EMAIL}?subject=${encodeURIComponent(subject)}&body=${body}`

    window.location.href = mailtoLink

    // Clear cart after order is placed
    setTimeout(() => {
      clearCart()
      router.push("/")
    }, 1000)
  }

  if (cart.length === 0) {
    return null
  }

  return (
    <div className="min-h-screen">
      {/* Header */}
      <header className="border-b border-border bg-background">
        <div className="container mx-auto flex h-16 items-center justify-between px-4">
          <Link href="/" className="flex items-center gap-3 hover:opacity-80 transition-opacity">
            <img 
              src="/logos/logo-icon.png" 
              alt="Protocol Zero" 
              className="h-10 w-auto"
            />
            <span className="text-xl font-bold tracking-tight">Protocol Zero</span>
          </Link>
        </div>
      </header>

      {/* Main Content */}
      <main className="container mx-auto px-4 py-8">
        <Link
          href="/"
          className="inline-flex items-center gap-2 text-sm text-muted-foreground hover:text-foreground mb-6 focus:outline-none focus:ring-2 focus:ring-ring focus:ring-offset-2 rounded"
        >
          <ArrowLeft className="h-4 w-4" aria-hidden="true" />
          <span>Back to catalogue</span>
        </Link>

        <h1 className="mb-8 text-3xl font-bold tracking-tight">Checkout</h1>

        <div className="grid gap-8 lg:grid-cols-2">
          {/* Left Column - Order Details & Payment */}
          <div className="space-y-8">
            {/* Order ID */}
            <div className="rounded-lg border border-border bg-card p-6">
              <h2 className="mb-4 text-xl font-semibold">Order ID</h2>
              <div className="flex items-center gap-3">
                <code className="flex-1 rounded bg-secondary px-3 py-2 font-mono text-sm">{orderId}</code>
              </div>
              <p className="mt-2 text-xs text-muted-foreground">Use this ID for your e-Transfer security answer</p>
            </div>

            {/* Customer Information (Optional) */}
            <div className="rounded-lg border border-border bg-card p-6">
              <h2 className="mb-4 text-xl font-semibold">
                Contact Information <span className="text-sm font-normal text-muted-foreground">(Optional)</span>
              </h2>
              <div className="space-y-4">
                <div>
                  <label htmlFor="name" className="mb-2 block text-sm font-medium">
                    Name
                  </label>
                  <Input
                    id="name"
                    type="text"
                    value={customerName}
                    onChange={(e) => setCustomerName(e.target.value)}
                    placeholder="Your name"
                  />
                </div>
                <div>
                  <label htmlFor="email" className="mb-2 block text-sm font-medium">
                    Email
                  </label>
                  <Input
                    id="email"
                    type="email"
                    value={customerEmail}
                    onChange={(e) => setCustomerEmail(e.target.value)}
                    placeholder="your@email.com"
                  />
                </div>
                <div>
                  <label htmlFor="phone" className="mb-2 block text-sm font-medium">
                    Phone
                  </label>
                  <Input
                    id="phone"
                    type="tel"
                    value={customerPhone}
                    onChange={(e) => setCustomerPhone(e.target.value)}
                    placeholder="(555) 123-4567"
                  />
                </div>
              </div>
            </div>

            {/* Payment Instructions */}
            <div className="rounded-lg border border-accent/50 bg-card p-6">
              <h2 className="mb-4 text-xl font-semibold">Interac e-Transfer Payment</h2>
              <div className="space-y-4">
                <div>
                  <p className="mb-1 text-sm font-medium">Send to:</p>
                  <code className="block rounded bg-secondary px-3 py-2 text-sm">{STORE_EMAIL}</code>
                </div>
                <div>
                  <p className="mb-1 text-sm font-medium">Security Question:</p>
                  <code className="block rounded bg-secondary px-3 py-2 text-sm">{SECURITY_QUESTION}</code>
                </div>
                <div>
                  <p className="mb-1 text-sm font-medium">Answer:</p>
                  <code className="block rounded bg-secondary px-3 py-2 text-sm">{SECURITY_ANSWER}</code>
                </div>
                <div className="flex gap-2">
                  <CopyButton text={total.toFixed(2)} label="Copy Amount" />
                  <CopyButton text={`Order ${orderId}`} label="Copy Memo" />
                </div>
              </div>
            </div>
          </div>

          {/* Right Column - Order Summary */}
          <div className="space-y-6">
            <CheckoutSummary cart={cart} />
            <Button
              onClick={handlePlaceOrder}
              size="lg"
              className="w-full gap-2"
              aria-label="Place order and send email"
            >
              <Mail className="h-5 w-5" aria-hidden="true" />
              <span>Place Order</span>
            </Button>
            <p className="text-center text-xs text-muted-foreground text-pretty">
              Clicking "Place Order" will open your email client with order details. Complete your e-Transfer to
              finalize the purchase.
            </p>
            <div className="rounded-lg border border-border bg-muted/50 p-4">
              <p className="text-sm text-muted-foreground">
                <strong className="text-foreground">Pickup:</strong> {PICKUP_LOCATION}
              </p>
              <p className="mt-2 text-xs text-muted-foreground">
                You'll receive pickup instructions after payment is confirmed.
              </p>
            </div>
          </div>
        </div>
      </main>
    </div>
  )
}
