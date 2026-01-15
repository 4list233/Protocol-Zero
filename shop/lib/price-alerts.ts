// Price Drop Alert Management
// Allows users to subscribe to price drop notifications

export type PriceAlert = {
  productId: string
  email: string
  currentPrice: number
  createdAt: string
}

const PRICE_ALERTS_KEY = "protocol-zero-price-alerts"

export function subscribeToPriceAlert(productId: string, email: string, currentPrice: number): boolean {
  if (typeof window === "undefined") return false
  
  try {
    const stored = localStorage.getItem(PRICE_ALERTS_KEY)
    const existing: PriceAlert[] = stored ? JSON.parse(stored) : []
    
    // Check if already subscribed
    const alreadySubscribed = existing.some(
      alert => alert.productId === productId && alert.email === email
    )
    
    if (!alreadySubscribed) {
      existing.push({
        productId,
        email,
        currentPrice,
        createdAt: new Date().toISOString()
      })
      localStorage.setItem(PRICE_ALERTS_KEY, JSON.stringify(existing))
      return true
    }
    
    return false
  } catch (error) {
    console.error("Failed to subscribe to price alert:", error)
    return false
  }
}

export function getPriceAlerts(productId?: string): PriceAlert[] {
  if (typeof window === "undefined") return []
  
  try {
    const stored = localStorage.getItem(PRICE_ALERTS_KEY)
    const alerts: PriceAlert[] = stored ? JSON.parse(stored) : []
    
    if (productId) {
      return alerts.filter(alert => alert.productId === productId)
    }
    
    return alerts
  } catch (error) {
    console.error("Failed to load price alerts:", error)
    return []
  }
}

export function removePriceAlert(productId: string, email: string): void {
  if (typeof window === "undefined") return
  
  try {
    const stored = localStorage.getItem(PRICE_ALERTS_KEY)
    const existing: PriceAlert[] = stored ? JSON.parse(stored) : []
    
    const filtered = existing.filter(
      alert => !(alert.productId === productId && alert.email === email)
    )
    
    localStorage.setItem(PRICE_ALERTS_KEY, JSON.stringify(filtered))
  } catch (error) {
    console.error("Failed to remove price alert:", error)
  }
}
