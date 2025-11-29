// Knack-based orders operations (replaces Firestore orders)
import {
  getKnackRecords,
  getKnackRecord,
  createKnackRecord,
  updateKnackRecord,
  isKnackConfigured,
} from './knack-client'
import { KNACK_CONFIG, getFieldValue } from './knack-config'
import type { Order, OrderStatus, AdminAction, StatusHistoryEntry, OrderItem } from './orders'

// Knack object key for orders (from config or env)
const ORDERS_OBJECT_KEY = KNACK_CONFIG.objectKeys.orders
const ORDER_FIELDS = KNACK_CONFIG.fields.orders

// Map Knack record to Order type
function mapKnackRecordToOrder(record: Record<string, unknown>): Order {
  // Parse JSON fields
  let items: OrderItem[] = []
  try {
    const itemsField = getFieldValue(record, ORDER_FIELDS.items, 'Items')
    if (typeof itemsField === 'string') {
      items = JSON.parse(itemsField)
    } else if (Array.isArray(itemsField)) {
      items = itemsField as OrderItem[]
    }
  } catch {
    items = []
  }

  let payment: Order['payment'] = { method: 'etransfer', status: 'pending' }
  try {
    const paymentField = getFieldValue(record, ORDER_FIELDS.paymentStatus, 'Payment Status')
    const etransferRef = getFieldValue(record, ORDER_FIELDS.etransferRef, 'E-Transfer Reference')
    const paymentReceivedAt = getFieldValue(record, ORDER_FIELDS.paymentReceivedAt, 'Payment Received At')
    
    payment = {
      method: 'etransfer',
      status: (paymentField as 'pending' | 'paid') || 'pending',
      etransferRef: etransferRef ? String(etransferRef) : undefined,
      receivedAt: paymentReceivedAt ? new Date(String(paymentReceivedAt)) : undefined,
    }
  } catch {
    // Use defaults
  }

  let shipping: Order['shipping'] | undefined
  try {
    const shippingField = getFieldValue(record, ORDER_FIELDS.shippingInfo, 'Shipping Info')
    if (typeof shippingField === 'string') {
      shipping = JSON.parse(shippingField)
    }
  } catch {
    // Leave undefined
  }

  let pickup: Order['pickup'] | undefined
  try {
    const pickupField = getFieldValue(record, ORDER_FIELDS.pickupInfo, 'Pickup Info')
    if (typeof pickupField === 'string') {
      pickup = JSON.parse(pickupField)
    }
  } catch {
    // Leave undefined
  }

  let dropoff: Order['dropoff'] | undefined
  try {
    const dropoffField = getFieldValue(record, ORDER_FIELDS.dropoffInfo, 'Dropoff Info')
    if (typeof dropoffField === 'string') {
      dropoff = JSON.parse(dropoffField)
    }
  } catch {
    // Leave undefined
  }

  let taobao: Order['taobao'] | undefined
  try {
    const taobaoField = getFieldValue(record, ORDER_FIELDS.taobaoInfo, 'Taobao Info')
    if (typeof taobaoField === 'string') {
      taobao = JSON.parse(taobaoField)
    }
  } catch {
    // Leave undefined
  }

  let statusHistory: StatusHistoryEntry[] = []
  try {
    const historyField = getFieldValue(record, ORDER_FIELDS.statusHistory, 'Status History')
    if (typeof historyField === 'string') {
      statusHistory = JSON.parse(historyField)
    } else if (Array.isArray(historyField)) {
      statusHistory = historyField as StatusHistoryEntry[]
    }
  } catch {
    statusHistory = []
  }

  const createdAtValue = getFieldValue(record, ORDER_FIELDS.createdAt, 'Created At')
  const updatedAtValue = getFieldValue(record, ORDER_FIELDS.updatedAt, 'Updated At')

  return {
    id: String(record.id || ''),
    userId: String(getFieldValue(record, ORDER_FIELDS.userId, 'User ID') || ''),
    userEmail: getFieldValue(record, ORDER_FIELDS.userEmail, 'User Email')
      ? String(getFieldValue(record, ORDER_FIELDS.userEmail, 'User Email'))
      : undefined,
    customerName: getFieldValue(record, ORDER_FIELDS.customerName, 'Customer Name')
      ? String(getFieldValue(record, ORDER_FIELDS.customerName, 'Customer Name'))
      : undefined,
    customerPhone: getFieldValue(record, ORDER_FIELDS.customerPhone, 'Customer Phone')
      ? String(getFieldValue(record, ORDER_FIELDS.customerPhone, 'Customer Phone'))
      : undefined,
    items,
    subtotalCad: Number(getFieldValue(record, ORDER_FIELDS.subtotalCad, 'Subtotal CAD') || 0),
    shippingCad: Number(getFieldValue(record, ORDER_FIELDS.shippingCad, 'Shipping CAD') || 0),
    totalCad: Number(getFieldValue(record, ORDER_FIELDS.totalCad, 'Total CAD') || 0),
    payment,
    status: (getFieldValue(record, ORDER_FIELDS.status, 'Status') as OrderStatus) || 'placed',
    shipping,
    pickup,
    dropoff,
    taobao,
    statusHistory,
    createdAt: createdAtValue ? new Date(String(createdAtValue)) : new Date(),
    updatedAt: updatedAtValue ? new Date(String(updatedAtValue)) : new Date(),
  }
}

// Map Order to Knack record format
function mapOrderToKnackRecord(order: Omit<Order, 'id' | 'createdAt' | 'updatedAt'>): Record<string, unknown> {
  const record: Record<string, unknown> = {}
  
  record[ORDER_FIELDS.userId] = order.userId
  // Only set optional fields if they have valid field keys
  if (ORDER_FIELDS.userEmail) record[ORDER_FIELDS.userEmail] = order.userEmail || null
  if (ORDER_FIELDS.customerName) record[ORDER_FIELDS.customerName] = order.customerName || null
  if (ORDER_FIELDS.customerPhone) record[ORDER_FIELDS.customerPhone] = order.customerPhone || null
  record[ORDER_FIELDS.items] = JSON.stringify(order.items)
  record[ORDER_FIELDS.subtotalCad] = order.subtotalCad
  record[ORDER_FIELDS.shippingCad] = order.shippingCad
  record[ORDER_FIELDS.totalCad] = order.totalCad
  record[ORDER_FIELDS.paymentMethod] = order.payment.method
  record[ORDER_FIELDS.paymentStatus] = order.payment.status
  record[ORDER_FIELDS.etransferRef] = order.payment.etransferRef || null
  record[ORDER_FIELDS.paymentReceivedAt] = order.payment.receivedAt 
    ? order.payment.receivedAt.toISOString() 
    : null
  record[ORDER_FIELDS.status] = order.status
  record[ORDER_FIELDS.shippingInfo] = order.shipping ? JSON.stringify(order.shipping) : null
  record[ORDER_FIELDS.pickupInfo] = order.pickup ? JSON.stringify(order.pickup) : null
  record[ORDER_FIELDS.dropoffInfo] = order.dropoff ? JSON.stringify(order.dropoff) : null
  record[ORDER_FIELDS.taobaoInfo] = order.taobao ? JSON.stringify(order.taobao) : null
  record[ORDER_FIELDS.statusHistory] = JSON.stringify(order.statusHistory)
  
  return record
}

export async function createOrder(
  data: Omit<Order, 'id' | 'createdAt' | 'updatedAt' | 'statusHistory'>
): Promise<string> {
  if (!isKnackConfigured()) {
    throw new Error('Knack is not configured. Please set KNACK_APPLICATION_ID and KNACK_REST_API_KEY.')
  }

  const statusHistory: StatusHistoryEntry[] = [{ status: data.status, at: new Date() }]
  const orderData = mapOrderToKnackRecord({ ...data, statusHistory })

  return await createKnackRecord(ORDERS_OBJECT_KEY, orderData)
}

export async function getOrders(opts?: {
  status?: OrderStatus
  pageSize?: number
  afterCreatedAt?: Date
}): Promise<Order[]> {
  if (!isKnackConfigured()) {
    throw new Error('Knack is not configured. Please set KNACK_APPLICATION_ID and KNACK_REST_API_KEY.')
  }

  const filters: Record<string, unknown> = {}
  if (opts?.status) {
    filters[ORDER_FIELDS.status] = opts.status
  }

  const records = await getKnackRecords(ORDERS_OBJECT_KEY, {
    filters,
    sortField: ORDER_FIELDS.createdAt,
    sortOrder: 'desc',
    perPage: opts?.pageSize || 25,
  })

  return records.map(mapKnackRecordToOrder)
}

export async function getOrderById(orderId: string): Promise<Order | null> {
  if (!isKnackConfigured()) {
    throw new Error('Knack is not configured. Please set KNACK_APPLICATION_ID and KNACK_REST_API_KEY.')
  }

  const record = await getKnackRecord(ORDERS_OBJECT_KEY, orderId)
  if (!record) return null

  return mapKnackRecordToOrder(record as Record<string, unknown>)
}

export async function applyAdminAction(orderId: string, action: AdminAction): Promise<{ ok: boolean; status: OrderStatus }> {
  if (!isKnackConfigured()) {
    throw new Error('Knack is not configured. Please set KNACK_APPLICATION_ID and KNACK_REST_API_KEY.')
  }

  const order = await getOrderById(orderId)
  if (!order) throw new Error('Order not found')

  const now = new Date()
  const history: StatusHistoryEntry[] = Array.isArray(order.statusHistory) ? order.statusHistory : []

  let nextStatus: OrderStatus | undefined
  const updates: Record<string, unknown> = {}

  // Extract action metadata
  const actorId = 'payload' in action && action.payload && typeof action.payload === 'object' 
    ? (action.payload as { actorId?: string }).actorId 
    : undefined
  const note = 'payload' in action && action.payload && typeof action.payload === 'object'
    ? (action.payload as { note?: string }).note
    : undefined

  switch (action.type) {
    case 'markPaid': {
      nextStatus = 'paid'
      updates[ORDER_FIELDS.paymentStatus] = 'paid'
      updates[ORDER_FIELDS.etransferRef] = action.payload?.etransferRef || order.payment?.etransferRef || null
      updates[ORDER_FIELDS.paymentReceivedAt] = now.toISOString()
      break
    }
    case 'setPurchasing': {
      nextStatus = 'purchasing'
      if (action.payload?.taobao) {
        updates[ORDER_FIELDS.taobaoInfo] = JSON.stringify(action.payload.taobao)
      }
      break
    }
    case 'setInProduction': {
      nextStatus = 'in_production'
      break
    }
    case 'markShipped': {
      nextStatus = 'shipped'
      updates[ORDER_FIELDS.shippingInfo] = JSON.stringify({
        ...order.shipping,
        ...action.payload.shipping,
        shippedAt: action.payload.shipping.shippedAt || now,
      })
      break
    }
    case 'schedulePickup': {
      nextStatus = 'ready_for_pickup'
      updates[ORDER_FIELDS.pickupInfo] = JSON.stringify(action.payload.pickup)
      break
    }
    case 'recordDropOff': {
      nextStatus = 'dropped_off'
      updates[ORDER_FIELDS.dropoffInfo] = JSON.stringify(action.payload.dropoff)
      break
    }
    case 'complete': {
      nextStatus = 'completed'
      break
    }
    case 'cancel': {
      nextStatus = 'cancelled'
      break
    }
  }

  if (!nextStatus) throw new Error('Invalid action')

  const historyEntry: StatusHistoryEntry = {
    status: nextStatus,
    at: now,
    actorId,
    note,
  }

  updates[ORDER_FIELDS.status] = nextStatus
  updates[ORDER_FIELDS.statusHistory] = JSON.stringify([...history, historyEntry])
  updates[ORDER_FIELDS.updatedAt] = now.toISOString()

  await updateKnackRecord(ORDERS_OBJECT_KEY, orderId, updates)

  return { ok: true, status: nextStatus }
}
