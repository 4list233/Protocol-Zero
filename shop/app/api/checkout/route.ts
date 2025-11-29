import { NextResponse } from 'next/server'
import { createKnackUser, getUserByEmail, getUserByFirebaseUid } from '@/lib/knack-users'
import { createKnackRecord, getKnackRecords } from '@/lib/knack-client'
import { KNACK_CONFIG } from '@/lib/knack-config'

export const dynamic = 'force-dynamic'

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
  } catch (error) {
    console.warn('Could not fetch existing orders:', error)
  }
  
  const nextSequence = String(maxSequence + 1).padStart(4, '0')
  return `${todayPrefix}${nextSequence}`
}

export async function POST(request: Request) {
  try {
    const body: CheckoutRequest = await request.json()
    
    // Validate required fields
    if (!body.email || !body.displayName) {
      return NextResponse.json(
        { error: 'Email and display name are required' },
        { status: 400 }
      )
    }
    
    if (!body.items || body.items.length === 0) {
      return NextResponse.json(
        { error: 'Order must have at least one item' },
        { status: 400 }
      )
    }
    
    // Step 1: Create or get Knack user record
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
      console.log(`Using existing Knack user: ${knackUserId}`)
    } else {
      // Create new Knack user (guest or registered)
      knackUserId = await createKnackUser({
        displayName: body.displayName,
        name: body.name || body.displayName,
        userId: userId,
        email: body.email,
        phone: body.phone,
        isGuest: isGuest,
      })
      isNewUser = true
      console.log(`Created new Knack user (${isGuest ? 'guest' : 'registered'}): ${knackUserId}`)
    }
    
    // Step 2: Generate unique order number
    const orderNumber = await generateUniqueOrderNumber()
    console.log(`Generated order number: ${orderNumber}`)
    
    // Step 3: Create order in Knack
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
    console.log(`Created order: ${orderId}`)
    
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
    console.error('Checkout error:', error)
    return NextResponse.json(
      { error: error instanceof Error ? error.message : 'Checkout failed' },
      { status: 500 }
    )
  }
}
