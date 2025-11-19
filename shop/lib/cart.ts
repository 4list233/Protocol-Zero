import type { Product } from "./products"
import { getProductPrice } from "./pricing"

export type CartItem = {
  product: Product
  quantity: number
}

const CART_KEY = "protocol-zero-cart"

// Get cart from localStorage
export function getCart(): CartItem[] {
  if (typeof window === "undefined") return []
  const cart = localStorage.getItem(CART_KEY)
  return cart ? JSON.parse(cart) : []
}

// Save cart to localStorage
function saveCart(cart: CartItem[]): void {
  if (typeof window === "undefined") return
  localStorage.setItem(CART_KEY, JSON.stringify(cart))
  // Dispatch event to notify components of cart changes
  window.dispatchEvent(new Event('cartUpdated'))
}

// Add item to cart
export function addToCart(product: Product, quantity: number = 1): void {
  const cart = getCart()
  const existingItem = cart.find(item => item.product.id === product.id)

  if (existingItem) {
    existingItem.quantity += quantity
  } else {
    cart.push({ product, quantity })
  }

  saveCart(cart)
}

// Remove item from cart
export function removeFromCart(productId: string): void {
  const cart = getCart()
  const updatedCart = cart.filter(item => item.product.id !== productId)
  saveCart(updatedCart)
}

// Update item quantity
export function updateQuantity(productId: string, quantity: number): void {
  const cart = getCart()
  const item = cart.find(item => item.product.id === productId)
  
  if (item) {
    if (quantity <= 0) {
      removeFromCart(productId)
    } else {
      item.quantity = quantity
      saveCart(cart)
    }
  }
}

// Clear entire cart
export function clearCart(): void {
  if (typeof window === "undefined") return
  localStorage.removeItem(CART_KEY)
  // Dispatch event to notify components of cart changes
  window.dispatchEvent(new Event('cartUpdated'))
}

// Get cart total
export function getCartTotal(cart: CartItem[]): number {
  return cart.reduce((total, item) => {
    const price = getProductPrice(item.product)
    return total + (price * item.quantity)
  }, 0)
}

// Get cart item count
export function getCartItemCount(cart: CartItem[]): number {
  return cart.reduce((count, item) => count + item.quantity, 0)
}

// Generate order ID
export function generateOrderId(): string {
  const timestamp = Date.now().toString(36)
  const random = Math.random().toString(36).substring(2, 7)
  return `${timestamp}${random}`.toUpperCase()
}
