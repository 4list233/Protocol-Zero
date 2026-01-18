"use client"

import { useState } from "react"
import { Bell } from "lucide-react"
import { subscribeToPriceAlert } from "@/lib/price-alerts"
import { useToast } from "@/components/toast-provider"

interface PriceAlertButtonProps {
  productId: string
  productTitle: string
  currentPrice: number
  className?: string
}

export function PriceAlertButton({ productId, productTitle, currentPrice, className = "" }: PriceAlertButtonProps) {
  const [showEmailInput, setShowEmailInput] = useState(false)
  const [email, setEmail] = useState("")
  const [isSubmitting, setIsSubmitting] = useState(false)
  const { addToast } = useToast()

  const handleSubmit = (e: React.FormEvent) => {
    e.preventDefault()
    
    if (!email || !email.includes("@")) {
      addToast({
        title: "Invalid email",
        description: "Please enter a valid email address"
      })
      return
    }

    setIsSubmitting(true)

    const success = subscribeToPriceAlert(productId, email, currentPrice)

    if (success) {
      addToast({
        title: "Price alert activated! 🔔",
        description: `We'll notify you at ${email} when the price drops`
      })
      setShowEmailInput(false)
      setEmail("")
    } else {
      addToast({
        title: "Already subscribed",
        description: "You're already subscribed to price alerts for this product"
      })
    }

    setIsSubmitting(false)
  }

  if (showEmailInput) {
    return (
      <form onSubmit={handleSubmit} className={`flex gap-2 ${className}`}>
        <input
          type="email"
          value={email}
          onChange={(e) => setEmail(e.target.value)}
          placeholder="your@email.com"
          className="flex-1 px-3 py-2 bg-[#1E1E1E] border border-[#2C2C2C] rounded-lg text-sm text-[#F5F5F5] focus:outline-none focus:border-[#3D9A6C]"
          required
        />
        <button
          type="submit"
          disabled={isSubmitting}
          className="px-4 py-2 bg-[#3D9A6C] text-black rounded-lg text-sm font-medium hover:bg-[#3D9A6C]/90 disabled:opacity-50"
        >
          {isSubmitting ? "..." : "Subscribe"}
        </button>
        <button
          type="button"
          onClick={() => setShowEmailInput(false)}
          className="px-3 py-2 bg-[#2C2C2C] text-[#A1A1A1] rounded-lg text-sm hover:bg-[#3C3C3C]"
        >
          Cancel
        </button>
      </form>
    )
  }

  return (
    <button
      onClick={() => setShowEmailInput(true)}
      className={`flex items-center gap-2 px-4 py-2 bg-[#1E1E1E] border border-[#2C2C2C] rounded-lg text-sm text-[#A1A1A1] hover:text-[#3D9A6C] hover:border-[#3D9A6C] transition-colors ${className}`}
    >
      <Bell className="h-4 w-4" />
      <span>Notify me if price drops</span>
    </button>
  )
}
