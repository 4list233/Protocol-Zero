"use client"

import { useState, useEffect } from "react"
import Link from "next/link"
import { Button } from "@/components/ui/button"
import { Input } from "@/components/ui/input"
import { CopyButton } from "@/components/copy-button"
import { useCart } from "@/lib/cart-context"
import { PromoExcludesAddonsNotice, AddonBadge } from "@/components/addon-items-preview"
import { STORE_EMAIL } from "@/lib/constants"
import { ArrowLeft, Loader2, CheckCircle, AlertCircle, Eye, EyeOff, User, LogIn, Mail, Tag, Sparkles, X } from "lucide-react"
import { useRouter } from "next/navigation"
import { useAuth } from "@/lib/auth-context"
import Image from "next/image"

// Prevent static generation - checkout requires client-side context and localStorage
export const dynamic = 'force-dynamic'

type CheckoutMode = 'guest' | 'sign_in'
type CheckoutStep = 'details' | 'processing' | 'success' | 'error'

type OrderResult = {
  success: boolean
  orderId?: string
  orderNumber?: string
  isNewUser?: boolean
  message?: string
  payment?: {
    method: string
    email: string
    amount: number
    reference: string
    instructions: string
  }
  error?: string
}

export default function CheckoutPage() {
  const router = useRouter()
  const { user, signInWithEmail, resetPassword } = useAuth()
  const {
    items,
    regularSubtotal,
    addonSubtotal,
    subtotal,
    promoDiscount,
    total,
    itemCount,
    promoCode,
    applyPromoCode,
    removePromoCode,
    clearCart,
    getItemPrice,
    isPromoApplicable,
  } = useCart()
  
  // Checkout mode
  const [mode, setMode] = useState<CheckoutMode>('guest')
  
  // Form state
  const [displayName, setDisplayName] = useState("")
  const [email, setEmail] = useState("")
  const [password, setPassword] = useState("")
  const [phone, setPhone] = useState("")
  const [showPassword, setShowPassword] = useState(false)
  
  // Promo code state
  const [promoInput, setPromoInput] = useState("")
  const [promoLoading, setPromoLoading] = useState(false)
  const [promoError, setPromoError] = useState("")
  
  // Password reset state
  const [showResetPassword, setShowResetPassword] = useState(false)
  const [resetEmailSent, setResetEmailSent] = useState(false)
  
  // Checkout state
  const [step, setStep] = useState<CheckoutStep>('details')
  const [orderResult, setOrderResult] = useState<OrderResult | null>(null)
  const [error, setError] = useState<string>("")

  useEffect(() => {
    if (items.length === 0 && step !== 'success') {
      router.push("/shop")
    }
    
    // Pre-fill if user is logged in
    if (user?.email) {
      setEmail(user.email)
      setMode('sign_in')
    }
    if (user?.displayName) {
      setDisplayName(user.displayName)
    }
  }, [router, user, items.length, step])

  // Validation
  const isEmailValid = /^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(email)
  const isPasswordValid = password.length >= 6
  
  // Form validation based on mode
  const isGuestFormValid = displayName.trim() && isEmailValid
  const isSignInFormValid = isEmailValid && isPasswordValid
  
  const isFormValid = mode === 'guest' ? isGuestFormValid : isSignInFormValid
  
  // Handle promo code
  const handleApplyPromo = async () => {
    if (!promoInput.trim()) return
    
    setPromoLoading(true)
    setPromoError("")
    
    const success = await applyPromoCode(promoInput)
    
    if (!success) {
      setPromoError("Invalid promo code")
    }
    
    setPromoLoading(false)
  }
  
  const handleResetPassword = async () => {
    if (!isEmailValid) {
      setError("Please enter a valid email address first")
      return
    }
    
    try {
      await resetPassword(email)
      setResetEmailSent(true)
      setError("")
    } catch (err: unknown) {
      const error = err as { code?: string }
      if (error.code === 'auth/user-not-found') {
        setError("No account found with this email. Try Guest Checkout or Create Account instead.")
      } else {
        setError("Failed to send reset email. Please try again.")
      }
    }
  }
  
  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault()
    
    if (!isFormValid) {
      setError("Please fill in all required fields correctly")
      return
    }
    
    setError("")
    setStep('processing')
    
    try {
      let firebaseUid: string | undefined = undefined
      let userName = displayName
      
      // Handle Firebase authentication for sign in mode
      if (mode === 'sign_in') {
        try {
          const firebaseUser = await signInWithEmail(email, password)
          firebaseUid = firebaseUser.uid
          userName = firebaseUser.displayName || displayName || email.split('@')[0]
          console.log(`Signed in Firebase user: ${firebaseUid}`)
        } catch (signInError: unknown) {
          const error = signInError as { code?: string }
          console.error('Sign in failed:', signInError)
          if (error.code === 'auth/user-not-found') {
            throw new Error('No account found with this email. Use Guest Checkout instead, or click "Forgot Password?" to create an account.')
          } else if (error.code === 'auth/wrong-password' || error.code === 'auth/invalid-credential') {
            throw new Error('Incorrect password. Click "Forgot Password?" to reset it.')
          } else {
            throw new Error('Sign in failed. Please check your credentials.')
          }
        }
      }
      
      console.log(`Checkout mode: ${mode}, Firebase UID: ${firebaseUid || 'none (guest)'}`)
      
      // Build checkout items from cart with proper pricing
      const checkoutItems = items.map(item => {
        const price = getItemPrice(item)
        const isAddon = item.itemType === "addon"
        
        return {
          variantId: item.variantId,
          productId: item.productId,
          productTitle: item.productTitle,
          variantTitle: item.variantTitle,
          sku: item.sku || '',
          quantity: item.quantity,
          unitPriceCad: price,
          isAddon,
          regularPrice: item.regularPrice,
          addonPrice: item.addonPrice,
        }
      })
      
      // Calculate totals
      const subtotalCad = subtotal
      const shippingCad = 0
      const promoDiscountCad = promoDiscount
      const totalCad = total
      
      // Call checkout API
      const response = await fetch('/api/checkout', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          firebaseUid,
          isGuest: mode === 'guest',
          email,
          displayName: userName || displayName || email.split('@')[0],
          name: userName || displayName || email.split('@')[0],
          phone: phone || undefined,
          items: checkoutItems,
          subtotalCad,
          shippingCad,
          promoCode: promoCode?.isValid ? promoCode.code : undefined,
          promoDiscountCad,
          totalCad,
        }),
      })
      
      const result: OrderResult = await response.json()
      
      if (!response.ok || !result.success) {
        throw new Error(result.error || 'Checkout failed')
      }
      
      setOrderResult(result)
      setStep('success')
      
      // Clear cart after successful order
      clearCart()
      
    } catch (err) {
      console.error('Checkout error:', err)
      setError(err instanceof Error ? err.message : 'Checkout failed. Please try again.')
      setStep('error')
    }
  }

  if (items.length === 0 && step !== 'success') {
    return null
  }

  // Success screen
  if (step === 'success' && orderResult) {
    return (
      <div className="min-h-screen bg-[#0A0A0A]">
        <header className="border-b border-[#1C1C1C] bg-[#0A0A0A]">
          <div className="container mx-auto flex h-16 items-center justify-between px-4">
            <Link href="/" className="flex items-center gap-3 hover:opacity-80 transition-opacity">
              <img src="/logos/logo-icon.png" alt="Protocol Zero" className="h-10 w-auto" />
              <span className="text-xl font-bold tracking-tight text-[#F5F5F5]">Protocol Zero</span>
            </Link>
          </div>
        </header>

        <main className="container mx-auto px-4 py-12">
          <div className="max-w-2xl mx-auto">
            <div className="text-center mb-8">
              <CheckCircle className="h-16 w-16 text-[#3D9A6C] mx-auto mb-4" />
              <h1 className="text-3xl font-bold text-[#F5F5F5] mb-2">Order Placed!</h1>
              <p className="text-[#A1A1A1]">Your order has been placed successfully.</p>
            </div>

            <div className="bg-[#1C1C1C] rounded-lg border border-[#2C2C2C] p-6 mb-6">
              <h2 className="text-xl font-semibold text-[#F5F5F5] mb-4">Order Details</h2>
              <div className="space-y-3">
                <div className="flex justify-between">
                  <span className="text-[#A1A1A1]">Order Number:</span>
                  <code className="text-[#3D9A6C] font-mono">{orderResult.orderNumber}</code>
                </div>
              </div>
            </div>

            {orderResult.payment && (
              <div className="bg-[#1C1C1C] rounded-lg border border-[#3D9A6C]/30 p-6 mb-6">
                <h2 className="text-xl font-semibold text-[#F5F5F5] mb-4">💳 Payment Instructions</h2>
                <div className="space-y-4">
                  <div className="bg-[#0A0A0A] rounded p-4 border border-[#2C2C2C]">
                    <p className="text-[#F5F5F5] font-medium mb-3">Send Interac e-Transfer to:</p>
                    <div className="flex items-center gap-3">
                      <code className="flex-1 bg-[#1C1C1C] px-3 py-2 rounded text-[#3D9A6C] font-mono">
                        {orderResult.payment.email}
                      </code>
                      <CopyButton text={orderResult.payment.email} label="Copy" />
                    </div>
                  </div>
                  
                  <div className="grid grid-cols-2 gap-4">
                    <div className="bg-[#0A0A0A] rounded p-4 border border-[#2C2C2C]">
                      <p className="text-[#A1A1A1] text-sm mb-1">Amount</p>
                      <div className="flex items-center gap-2">
                        <span className="text-2xl font-bold text-[#3D9A6C]">
                          ${orderResult.payment.amount.toFixed(2)}
                        </span>
                        <span className="text-[#A1A1A1] text-sm">CAD</span>
                      </div>
                    </div>
                    <div className="bg-[#0A0A0A] rounded p-4 border border-[#2C2C2C]">
                      <p className="text-[#A1A1A1] text-sm mb-1">Memo/Reference</p>
                      <div className="flex items-center gap-2">
                        <code className="text-[#F5F5F5] font-mono">{orderResult.orderNumber}</code>
                        <CopyButton text={orderResult.orderNumber || ''} label="" />
                      </div>
                    </div>
                  </div>
                  
                  <div className="bg-yellow-500/10 border border-yellow-500/30 rounded p-4">
                    <p className="text-yellow-400 text-sm">
                      ⚠️ <strong>Important:</strong> Please complete your e-Transfer within 2 hours. 
                      Orders not paid within this time may be cancelled.
                    </p>
                  </div>
                </div>
              </div>
            )}

            <div className="flex gap-4">
              <Link href="/shop" className="flex-1">
                <Button className="w-full bg-[#3D9A6C] hover:bg-[#2D8A5C]">
                  Continue Shopping
                </Button>
              </Link>
            </div>
          </div>
        </main>
      </div>
    )
  }

  // Error screen
  if (step === 'error') {
    return (
      <div className="min-h-screen bg-[#0A0A0A]">
        <header className="border-b border-[#1C1C1C] bg-[#0A0A0A]">
          <div className="container mx-auto flex h-16 items-center justify-between px-4">
            <Link href="/" className="flex items-center gap-3 hover:opacity-80 transition-opacity">
              <img src="/logos/logo-icon.png" alt="Protocol Zero" className="h-10 w-auto" />
              <span className="text-xl font-bold tracking-tight text-[#F5F5F5]">Protocol Zero</span>
            </Link>
          </div>
        </header>

        <main className="container mx-auto px-4 py-12">
          <div className="max-w-md mx-auto text-center">
            <AlertCircle className="h-16 w-16 text-red-500 mx-auto mb-4" />
            <h1 className="text-2xl font-bold text-[#F5F5F5] mb-2">Checkout Failed</h1>
            <p className="text-[#A1A1A1] mb-6">{error}</p>
            <Button onClick={() => setStep('details')} className="bg-[#3D9A6C] hover:bg-[#2D8A5C]">
              Try Again
            </Button>
          </div>
        </main>
      </div>
    )
  }

  // Processing screen
  if (step === 'processing') {
    return (
      <div className="min-h-screen bg-[#0A0A0A] flex items-center justify-center">
        <div className="text-center">
          <Loader2 className="h-12 w-12 text-[#3D9A6C] animate-spin mx-auto mb-4" />
          <h2 className="text-xl font-semibold text-[#F5F5F5]">Processing your order...</h2>
          <p className="text-[#A1A1A1] mt-2">Please wait while we place your order.</p>
        </div>
      </div>
    )
  }

  // Main checkout form
  return (
    <div className="min-h-screen bg-[#0A0A0A]">
      <header className="border-b border-[#1C1C1C] bg-[#0A0A0A]">
        <div className="container mx-auto flex h-16 items-center justify-between px-4">
          <Link href="/" className="flex items-center gap-3 hover:opacity-80 transition-opacity">
            <img src="/logos/logo-icon.png" alt="Protocol Zero" className="h-10 w-auto" />
            <span className="text-xl font-bold tracking-tight text-[#F5F5F5]">Protocol Zero</span>
          </Link>
        </div>
      </header>

      <main className="container mx-auto px-4 py-8">
        <Link
          href="/cart"
          className="inline-flex items-center gap-2 text-sm text-[#A1A1A1] hover:text-[#F5F5F5] mb-6"
        >
          <ArrowLeft className="h-4 w-4" />
          <span>Back to cart</span>
        </Link>

        <h1 className="mb-8 text-3xl font-bold tracking-tight text-[#F5F5F5]">Checkout</h1>

        <div className="grid gap-8 lg:grid-cols-2">
          {/* Left Column - Form */}
          <form onSubmit={handleSubmit} className="space-y-6">
            {/* Checkout Mode Selector */}
            <div className="bg-[#1C1C1C] rounded-lg border border-[#2C2C2C] p-4">
              <div className="grid grid-cols-2 gap-2">
                <button
                  type="button"
                  onClick={() => { setMode('guest'); setError(''); setShowResetPassword(false); }}
                  className={`flex items-center justify-center gap-2 py-3 px-4 rounded-lg font-medium transition-all ${
                    mode === 'guest'
                      ? 'bg-[#3D9A6C] text-black'
                      : 'bg-[#0A0A0A] text-[#A1A1A1] hover:text-[#F5F5F5] border border-[#2C2C2C]'
                  }`}
                >
                  <User className="h-4 w-4" />
                  Guest Checkout
                </button>
                <button
                  type="button"
                  onClick={() => { setMode('sign_in'); setError(''); setShowResetPassword(false); }}
                  className={`flex items-center justify-center gap-2 py-3 px-4 rounded-lg font-medium transition-all ${
                    mode === 'sign_in'
                      ? 'bg-[#3D9A6C] text-black'
                      : 'bg-[#0A0A0A] text-[#A1A1A1] hover:text-[#F5F5F5] border border-[#2C2C2C]'
                  }`}
                >
                  <LogIn className="h-4 w-4" />
                  Sign In
                </button>
              </div>
            </div>

            {/* Form Fields */}
            <div className="bg-[#1C1C1C] rounded-lg border border-[#2C2C2C] p-6">
              <h2 className="text-xl font-semibold text-[#F5F5F5] mb-2">
                {mode === 'guest' ? 'Contact Information' : 'Sign In'}
              </h2>
              <p className="text-[#A1A1A1] text-sm mb-6">
                {mode === 'guest' 
                  ? 'No account needed - just enter your details.'
                  : 'Sign in with your existing account.'}
              </p>
              
              <div className="space-y-4">
                {/* Name field - for guest only */}
                {mode === 'guest' && (
                  <div>
                    <label htmlFor="displayName" className="block text-sm font-medium text-[#F5F5F5] mb-2">
                      Name <span className="text-red-500">*</span>
                    </label>
                    <Input
                      id="displayName"
                      type="text"
                      value={displayName}
                      onChange={(e) => setDisplayName(e.target.value)}
                      placeholder="Your name"
                      className="bg-[#0A0A0A] border-[#2C2C2C] text-[#F5F5F5] placeholder:text-[#666]"
                      required
                    />
                  </div>
                )}

                {/* Email field - always shown */}
                <div>
                  <label htmlFor="email" className="block text-sm font-medium text-[#F5F5F5] mb-2">
                    Email <span className="text-red-500">*</span>
                  </label>
                  <Input
                    id="email"
                    type="email"
                    value={email}
                    onChange={(e) => setEmail(e.target.value)}
                    placeholder="your@email.com"
                    className="bg-[#0A0A0A] border-[#2C2C2C] text-[#F5F5F5] placeholder:text-[#666]"
                    required
                  />
                  {email && !isEmailValid && (
                    <p className="text-red-400 text-xs mt-1">Please enter a valid email</p>
                  )}
                </div>

                {/* Password field - for sign in only */}
                {mode === 'sign_in' && (
                  <div>
                    <label htmlFor="password" className="block text-sm font-medium text-[#F5F5F5] mb-2">
                      Password <span className="text-red-500">*</span>
                    </label>
                    <div className="relative">
                      <Input
                        id="password"
                        type={showPassword ? "text" : "password"}
                        value={password}
                        onChange={(e) => setPassword(e.target.value)}
                        placeholder="Enter your password"
                        className="bg-[#0A0A0A] border-[#2C2C2C] text-[#F5F5F5] placeholder:text-[#666] pr-10"
                        required
                      />
                      <button
                        type="button"
                        onClick={() => setShowPassword(!showPassword)}
                        className="absolute right-3 top-1/2 -translate-y-1/2 text-[#A1A1A1] hover:text-[#F5F5F5]"
                      >
                        {showPassword ? <EyeOff className="h-4 w-4" /> : <Eye className="h-4 w-4" />}
                      </button>
                    </div>
                    
                    {/* Forgot Password link */}
                    <button
                      type="button"
                      onClick={() => setShowResetPassword(!showResetPassword)}
                      className="text-[#3D9A6C] text-sm mt-2 hover:underline"
                    >
                      Forgot Password?
                    </button>
                  </div>
                )}

                {/* Password Reset Section */}
                {showResetPassword && mode === 'sign_in' && (
                  <div className="bg-[#0A0A0A] rounded-lg p-4 border border-[#2C2C2C]">
                    {resetEmailSent ? (
                      <div className="flex items-center gap-2 text-[#3D9A6C]">
                        <Mail className="h-4 w-4" />
                        <span className="text-sm">Password reset email sent! Check your inbox.</span>
                      </div>
                    ) : (
                      <>
                        <p className="text-sm text-[#A1A1A1] mb-3">
                          Enter your email above and click below to reset your password.
                        </p>
                        <Button
                          type="button"
                          onClick={handleResetPassword}
                          variant="outline"
                          className="w-full border-[#3D9A6C] text-[#3D9A6C] hover:bg-[#3D9A6C]/10"
                          disabled={!isEmailValid}
                        >
                          <Mail className="h-4 w-4 mr-2" />
                          Send Reset Email
                        </Button>
                      </>
                    )}
                  </div>
                )}

                {/* Phone field - optional, always shown */}
                <div>
                  <label htmlFor="phone" className="block text-sm font-medium text-[#F5F5F5] mb-2">
                    Phone <span className="text-[#A1A1A1] text-xs">(optional)</span>
                  </label>
                  <Input
                    id="phone"
                    type="tel"
                    value={phone}
                    onChange={(e) => setPhone(e.target.value)}
                    placeholder="(555) 123-4567"
                    className="bg-[#0A0A0A] border-[#2C2C2C] text-[#F5F5F5] placeholder:text-[#666]"
                  />
                </div>
              </div>
            </div>

            {/* Promo Code Section */}
            <div className="bg-[#1C1C1C] rounded-lg border border-[#2C2C2C] p-6">
              <h2 className="text-xl font-semibold text-[#F5F5F5] mb-4 flex items-center gap-2">
                <Tag className="h-5 w-5" />
                Promo Code
              </h2>
              
              {/* Show notice if cart has add-on items */}
              {items.some(item => item.itemType === "addon") && (
                <div className="mb-4">
                  <PromoExcludesAddonsNotice />
                </div>
              )}
              
              {promoCode?.isValid ? (
                <div className="flex items-center justify-between bg-[#3D9A6C]/10 border border-[#3D9A6C]/30 rounded-lg p-4">
                  <div className="flex items-center gap-2">
                    <CheckCircle className="h-5 w-5 text-[#3D9A6C]" />
                    <div>
                      <span className="font-medium text-[#F5F5F5]">{promoCode.code}</span>
                      <span className="text-[#3D9A6C] ml-2">
                        -{(promoCode.discount * 100).toFixed(0)}% off regular items
                      </span>
                    </div>
                  </div>
                  <Button
                    type="button"
                    variant="ghost"
                    size="sm"
                    onClick={removePromoCode}
                    className="text-[#A1A1A1] hover:text-red-400"
                  >
                    <X className="h-4 w-4" />
                  </Button>
                </div>
              ) : (
                <div className="flex gap-2">
                  <Input
                    value={promoInput}
                    onChange={(e) => setPromoInput(e.target.value.toUpperCase())}
                    placeholder="Enter promo code"
                    className="bg-[#0A0A0A] border-[#2C2C2C] text-[#F5F5F5] placeholder:text-[#666]"
                  />
                  <Button
                    type="button"
                    onClick={handleApplyPromo}
                    disabled={!promoInput.trim() || promoLoading}
                    className="bg-[#2C2C2C] hover:bg-[#3C3C3C] text-[#F5F5F5]"
                  >
                    {promoLoading ? <Loader2 className="h-4 w-4 animate-spin" /> : 'Apply'}
                  </Button>
                </div>
              )}
              
              {promoError && (
                <p className="text-red-400 text-sm mt-2">{promoError}</p>
              )}
            </div>

            {/* Payment Info Section */}
            <div className="bg-[#1C1C1C] rounded-lg border border-[#3D9A6C]/30 p-6">
              <h2 className="text-xl font-semibold text-[#F5F5F5] mb-4">Payment Method</h2>
              <div className="flex items-center gap-3 bg-[#0A0A0A] rounded p-4 border border-[#2C2C2C]">
                <div className="h-10 w-10 bg-[#3D9A6C]/20 rounded-full flex items-center justify-center">
                  <span className="text-lg">💳</span>
                </div>
                <div>
                  <p className="font-medium text-[#F5F5F5]">Interac e-Transfer</p>
                  <p className="text-sm text-[#A1A1A1]">Send to {STORE_EMAIL}</p>
                </div>
              </div>
              <p className="text-xs text-[#A1A1A1] mt-3">
                Payment instructions will be shown after placing your order.
              </p>
            </div>

            {error && (
              <div className="bg-red-500/10 border border-red-500/30 rounded p-4">
                <p className="text-red-400 text-sm">{error}</p>
              </div>
            )}

            <Button
              type="submit"
              size="lg"
              className="w-full bg-[#3D9A6C] hover:bg-[#2D8A5C] text-white font-semibold"
              disabled={!isFormValid}
            >
              Place Order • ${total.toFixed(2)} CAD
            </Button>
            
            <p className="text-center text-xs text-[#A1A1A1]">
              By placing your order, you agree to our terms. 
              Orders not paid within 2 hours may be cancelled.
            </p>
          </form>

          {/* Right Column - Order Summary */}
          <div className="space-y-6">
            <div className="bg-[#1C1C1C] rounded-lg border border-[#2C2C2C] p-6">
              <h2 className="text-xl font-semibold text-[#F5F5F5] mb-4">Order Summary</h2>
              
              {/* Items list */}
              <div className="space-y-4 mb-6">
                {items.map((item) => {
                  const price = getItemPrice(item)
                  const isAddon = item.itemType === "addon"
                  const promoApplies = isPromoApplicable(item) && promoCode?.isValid
                  
                  return (
                    <div key={item.variantId} className="flex gap-3">
                      <div className="relative w-16 h-16 rounded-md overflow-hidden bg-[#0A0A0A] flex-shrink-0">
                        <Image
                          src={item.productImage}
                          alt={item.productTitle}
                          fill
                          className="object-cover"
                          sizes="64px"
                        />
                      </div>
                      <div className="flex-1 min-w-0">
                        <p className="text-sm font-medium text-[#F5F5F5] truncate">{item.productTitle}</p>
                        <p className="text-xs text-[#A1A1A1]">{item.variantTitle}</p>
                        <div className="flex items-center gap-2 mt-1">
                          <span className="text-xs text-[#A1A1A1]">Qty: {item.quantity}</span>
                          {isAddon && (
                            <span className="inline-flex items-center gap-1 text-xs text-[#3D9A6C]">
                              <Sparkles className="h-3 w-3" />
                              Add-on
                            </span>
                          )}
                          {promoApplies && (
                            <span className="inline-flex items-center gap-1 text-xs text-[#3D9A6C]">
                              <Tag className="h-3 w-3" />
                              -{(promoCode!.discount * 100).toFixed(0)}%
                            </span>
                          )}
                        </div>
                      </div>
                      <div className="text-right">
                        <p className="text-sm font-medium text-[#F5F5F5]">
                          ${(price * item.quantity).toFixed(2)}
                        </p>
                        {isAddon && (
                          <p className="text-xs text-[#666] line-through">
                            ${(item.regularPrice * item.quantity).toFixed(2)}
                          </p>
                        )}
                      </div>
                    </div>
                  )
                })}
              </div>
              
              {/* Totals */}
              <div className="space-y-2 border-t border-[#2C2C2C] pt-4">
                <div className="flex justify-between text-sm">
                  <span className="text-[#A1A1A1]">Regular items</span>
                  <span className="text-[#F5F5F5]">${regularSubtotal.toFixed(2)}</span>
                </div>
                {addonSubtotal > 0 && (
                  <div className="flex justify-between text-sm">
                    <span className="text-[#A1A1A1] flex items-center gap-1">
                      <Sparkles className="h-3 w-3 text-[#3D9A6C]" />
                      Add-on items
                    </span>
                    <span className="text-[#3D9A6C]">${addonSubtotal.toFixed(2)}</span>
                  </div>
                )}
                {promoDiscount > 0 && (
                  <div className="flex justify-between text-sm">
                    <span className="text-[#A1A1A1] flex items-center gap-1">
                      <Tag className="h-3 w-3 text-[#3D9A6C]" />
                      Promo ({promoCode?.code})
                    </span>
                    <span className="text-[#3D9A6C]">-${promoDiscount.toFixed(2)}</span>
                  </div>
                )}
                <div className="flex justify-between text-sm">
                  <span className="text-[#A1A1A1]">Subtotal</span>
                  <span className="text-[#F5F5F5]">${subtotal.toFixed(2)}</span>
                </div>
                <div className="flex justify-between text-sm">
                  <span className="text-[#A1A1A1]">Shipping</span>
                  <span className="text-[#A1A1A1]">Free</span>
                </div>
                <div className="flex justify-between text-lg font-semibold border-t border-[#2C2C2C] pt-2 mt-2">
                  <span className="text-[#F5F5F5]">Total</span>
                  <span className="text-[#3D9A6C]">${total.toFixed(2)} CAD</span>
                </div>
              </div>
            </div>
          </div>
        </div>
      </main>
    </div>
  )
}
