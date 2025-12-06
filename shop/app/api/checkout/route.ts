import { NextResponse } from 'next/server'
import { createKnackUser, getUserByEmail, getUserByFirebaseUid } from '@/lib/knack-users'
import { createKnackRecord, getKnackRecords } from '@/lib/knack-client'
import { KNACK_CONFIG } from '@/lib/knack-config'

export const dynamic = 'force-dynamic'

// =============================================================================
// SECURITY: Bot/Spam Protection
// =============================================================================

// Honeypot field names (bots will fill these, humans won't see them)
const HONEYPOT_FIELDS = ['website', 'url', 'company', 'fax'] as const

// Minimum time (ms) between page load and checkout submission
// Bots typically submit instantly, humans take at least a few seconds
const MIN_SUBMISSION_TIME_MS = 3000 // 3 seconds

// Types for the checkout request
type CheckoutItem = {
  variantId: string // Knack variant record ID for connection
  productId: string
  productTitle: string
  variantTitle: string
  sku: string
  quantity: number
  unitPriceCad: number
}

type CheckoutRequest = {
  // Firebase Auth UID (optional for guest checkout)
  firebaseUid?: string
  
  // Guest checkout flag
  isGuest?: boolean
  
  // User details
  email: string
  displayName: string
  name?: string
  phone?: string
  
  // Order details
  items: CheckoutItem[]
  subtotalCad: number
  shippingCad: number
  totalCad: number
  
  // Security fields (honeypot + timing)
  _formLoadTime?: number  // Timestamp when form was loaded (for timing check)
  website?: string        // Honeypot: bots fill this
  url?: string            // Honeypot: bots fill this
  company?: string        // Honeypot: bots fill this
  fax?: string            // Honeypot: bots fill this
}

// Generate unique order number
async function generateUniqueOrderNumber(): Promise<string> {
  const ORDER_FIELDS = KNACK_CONFIG.fields.orders
  const ORDERS_OBJECT_KEY = KNACK_CONFIG.objectKeys.orders
  
  // Format: PZ-YYYYMMDD-XXXX (e.g., PZ-20251126-0001)
  const today = new Date()
  const dateStr = today.toISOString().slice(0, 10).replace(/-/g, '')
  
  // Get today's orders to find next sequence number
  const todayPrefix = `PZ-${dateStr}-`
  
  // Fetch existing orders to find the highest sequence for today
  let maxSequence = 0
  try {
    const existingOrders = await getKnackRecords<Record<string, unknown>>(ORDERS_OBJECT_KEY, {
      sortField: ORDER_FIELDS.orderNumber,
      sortOrder: 'desc',
      perPage: 100,
    })
    
    for (const order of existingOrders) {
      const orderNum = String(order[ORDER_FIELDS.orderNumber] || '')
      if (orderNum.startsWith(todayPrefix)) {
        const seq = parseInt(orderNum.slice(-4), 10)
        if (!isNaN(seq) && seq > maxSequence) {
          maxSequence = seq
        }
      }
    }
  } catch {
    // Continue with sequence 1 if we can't fetch existing orders
  }
  
  const nextSequence = String(maxSequence + 1).padStart(4, '0')
  return `${todayPrefix}${nextSequence}`
}

export async function POST(request: Request) {
  try {
    const body: CheckoutRequest = await request.json()
    
    // ==========================================================================
    // SECURITY: Bot Detection
    // ==========================================================================
    
    // Check honeypot fields - if any are filled, it's likely a bot
    for (const field of HONEYPOT_FIELDS) {
      if (body[field] && String(body[field]).trim() !== '') {
        // Log for monitoring but return generic error to not tip off bots
        console.warn('[Checkout] Honeypot triggered')
        // Return success-like response to confuse bots
        return NextResponse.json(
          { success: true, orderId: 'processing', message: 'Order received' },
          { status: 200 }
        )
      }
    }
    
    // Check timing - if submitted too fast, likely a bot
    if (body._formLoadTime) {
      const timeSinceLoad = Date.now() - body._formLoadTime
      if (timeSinceLoad < MIN_SUBMISSION_TIME_MS) {
        console.warn('[Checkout] Timing check failed - too fast')
        // Return success-like response to confuse bots
        return NextResponse.json(
          { success: true, orderId: 'processing', message: 'Order received' },
          { status: 200 }
        )
      }
    }
    
    // ==========================================================================
    // Input Validation
    // ==========================================================================
    
    // Validate email format
    const emailRegex = /^[^\s@]+@[^\s@]+\.[^\s@]+$/
    if (!body.email || !emailRegex.test(body.email)) {
      return NextResponse.json(
        { error: 'Valid email is required' },
        { status: 400 }
      )
    }
    
    // Sanitize and validate display name (prevent injection)
    if (!body.displayName || body.displayName.length < 2 || body.displayName.length > 100) {
      return NextResponse.json(
        { error: 'Display name must be 2-100 characters' },
        { status: 400 }
      )
    }
    
    // Strip HTML/script tags from user input
    const sanitizedDisplayName = body.displayName.replace(/<[^>]*>/g, '').trim()
    const sanitizedName = body.name?.replace(/<[^>]*>/g, '').trim()
    
    if (!body.items || body.items.length === 0) {
      return NextResponse.json(
        { error: 'Order must have at least one item' },
        { status: 400 }
      )
    }
    
    // Validate items have required fields and reasonable values
    for (const item of body.items) {
      if (!item.variantId || !item.productId || item.quantity < 1 || item.quantity > 99) {
        return NextResponse.json(
          { error: 'Invalid order items' },
          { status: 400 }
        )
      }
    }
    
    // Validate totals are reasonable
    if (body.totalCad < 0 || body.totalCad > 10000) {
      return NextResponse.json(
        { error: 'Invalid order total' },
        { status: 400 }
      )
    }
    
    // ==========================================================================
    // Step 1: Create or get Knack user record
    // ==========================================================================
    let knackUserId: string
    let isNewUser = false
    const isGuest = body.isGuest || !body.firebaseUid
    
    // Generate a guest ID if no Firebase UID provided
    const userId = body.firebaseUid || `guest_${Date.now()}_${Math.random().toString(36).substring(2, 8)}`
    
    // Check if Knack user already exists
    let existingKnackUser = null
    
    if (body.firebaseUid) {
      // Check by Firebase UID first
      existingKnackUser = await getUserByFirebaseUid(body.firebaseUid)
    }
    
    if (!existingKnackUser) {
      // Also check by email
      existingKnackUser = await getUserByEmail(body.email)
    }
    
    if (existingKnackUser) {
      knackUserId = existingKnackUser.id
    } else {
      // Create new Knack user (guest or registered) with sanitized input
      knackUserId = await createKnackUser({
        displayName: sanitizedDisplayName,
        name: sanitizedName || sanitizedDisplayName,
        userId: userId,
        email: body.email,
        phone: body.phone?.replace(/<[^>]*>/g, '').trim(),
        isGuest: isGuest,
      })
      isNewUser = true
    }
    
    // ==========================================================================
    // Step 2: Generate unique order number
    // ==========================================================================
    const orderNumber = await generateUniqueOrderNumber()
    
    // ==========================================================================
    // Step 3: Create order in Knack
    // ==========================================================================
    const ORDER_FIELDS = KNACK_CONFIG.fields.orders
    const ORDERS_OBJECT_KEY = KNACK_CONFIG.objectKeys.orders
    const now = new Date().toISOString()
    
    // Build the order record
    // For connection fields (User ID and Items), use array of Knack record IDs
    const orderData: Record<string, unknown> = {
      [ORDER_FIELDS.orderNumber]: orderNumber,
      // Connection to User - array of Knack record IDs
      [ORDER_FIELDS.userId]: [knackUserId],
      // Connection to Variants - array of variant Knack record IDs
      [ORDER_FIELDS.items]: body.items.map(item => item.variantId),
      [ORDER_FIELDS.subtotalCad]: body.subtotalCad,
      [ORDER_FIELDS.shippingCad]: body.shippingCad,
      [ORDER_FIELDS.totalCad]: body.totalCad,
      [ORDER_FIELDS.paymentMethod]: 'e-transfer',
      [ORDER_FIELDS.paymentStatus]: 'Pending',
      [ORDER_FIELDS.status]: 'Placed',
      [ORDER_FIELDS.statusHistory]: JSON.stringify([
        { status: 'Placed', at: now }
      ]),
      [ORDER_FIELDS.createdAt]: now,
      [ORDER_FIELDS.updatedAt]: now,
    }
    
    const orderId = await createKnackRecord(ORDERS_OBJECT_KEY, orderData)
    
    // Return success with order details
    return NextResponse.json({
      success: true,
      orderId,
      orderNumber,
      userId: knackUserId,
      firebaseUid: body.firebaseUid,
      isNewUser,
      message: isNewUser 
        ? 'Account created and order placed successfully!' 
        : 'Order placed successfully!',
      // E-transfer instructions
      payment: {
        method: 'e-transfer',
        email: 'protocolzeroairsoft@gmail.com',
        amount: body.totalCad,
        reference: orderNumber,
        instructions: `Please send $${body.totalCad.toFixed(2)} CAD via Interac e-Transfer to protocolzeroairsoft@gmail.com. Use order number ${orderNumber} as the memo. Orders not paid within 2 hours may be cancelled.`,
      }
    })
    
  } catch (error) {
    // Log error without exposing details
    console.error('[Checkout] Order creation failed')
    return NextResponse.json(
      { error: 'Checkout failed. Please try again.' },
      { status: 500 }
    )
  }
}
