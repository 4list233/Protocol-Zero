import { db } from '@/lib/firebase'
import {
  addDoc,
  collection,
  doc,
  getDoc,
  getDocs,
  orderBy,
  query,
  serverTimestamp,
  Timestamp,
  updateDoc,
  where,
  limit,
  startAfter,
} from 'firebase/firestore'

function requireDb() {
  if (!db) throw new Error('Firebase is not configured. Please set NEXT_PUBLIC_FIREBASE_* env vars.')
  return db
}

// =============== Types ===============
export type OrderItem = {
  productId: string
  title: string
  sku?: string
  option?: string // e.g., Colour: Black
  quantity: number
  unitPriceCad: number
  image?: string
}

export type PaymentInfo = {
  method: 'etransfer'
  status: 'pending' | 'paid'
  etransferRef?: string
  receivedAt?: Date | Timestamp
}

export type ShippingInfo = {
  carrier?: string
  tracking?: string
  shippedAt?: Date | Timestamp
  estimatedDelivery?: Date | Timestamp
}

export type PickupInfo = {
  locationId: 'ultimate-airsoft' | 'reception'
  locationLabel?: string
  scheduledAt: Date | Timestamp
  confirmedByCustomer?: boolean
}

export type DropOffInfo = {
  locationId: 'reception'
  scheduledAt: Date | Timestamp
  photoUrl?: string // proof photo URL
  staffName?: string
  notes?: string
}

export type TaobaoInfo = {
  orderId?: string
  orderUrl?: string
  purchasedAt?: Date | Timestamp
}

export type OrderStatus =
  | 'placed'
  | 'paid'
  | 'purchasing'
  | 'in_production'
  | 'shipped'
  | 'ready_for_pickup'
  | 'dropoff_scheduled'
  | 'dropped_off'
  | 'completed'
  | 'cancelled'

export type StatusHistoryEntry = {
  status: OrderStatus
  at: Date | Timestamp
  actorId?: string // admin or user id
  note?: string
}

export type Order = {
  id: string
  userId: string
  userEmail?: string
  customerName?: string
  customerPhone?: string
  items: OrderItem[]
  subtotalCad: number
  shippingCad: number
  totalCad: number
  payment: PaymentInfo
  status: OrderStatus
  shipping?: ShippingInfo
  pickup?: PickupInfo
  dropoff?: DropOffInfo
  taobao?: TaobaoInfo
  statusHistory: StatusHistoryEntry[]
  createdAt: Date | Timestamp
  updatedAt: Date | Timestamp
}

// =============== CRUD Helpers ===============

export async function createOrder(data: Omit<Order, 'id' | 'createdAt' | 'updatedAt' | 'statusHistory'>) {
  const now = serverTimestamp()
  const statusHistory: StatusHistoryEntry[] = [
    { status: data.status, at: new Date() },
  ]
  const docRef = await addDoc(collection(requireDb(), 'orders'), {
    ...data,
    createdAt: now,
    updatedAt: now,
    statusHistory,
  })
  return docRef.id
}

export async function getOrders(opts?: {
  status?: OrderStatus
  pageSize?: number
  afterCreatedAt?: Date | Timestamp
}): Promise<Order[]> {
  const constraints: any[] = []
  if (opts?.status) constraints.push(where('status', '==', opts.status))
  constraints.push(orderBy('createdAt', 'desc'))
  if (opts?.afterCreatedAt) constraints.push(startAfter(opts.afterCreatedAt))
  if (opts?.pageSize) constraints.push(limit(opts.pageSize))

  const q = query(collection(requireDb(), 'orders'), ...constraints)
  const snap = await getDocs(q)
  const orders: Order[] = []
  snap.forEach((d) => {
    const data = d.data() as any
    orders.push({ id: d.id, ...data })
  })
  return orders
}

export async function getOrderById(orderId: string): Promise<Order | null> {
  const ref = doc(requireDb(), 'orders', orderId)
  const snap = await getDoc(ref)
  if (!snap.exists()) return null
  const data = snap.data() as any
  return { id: snap.id, ...data }
}

export type AdminAction =
  | { type: 'markPaid'; payload: { etransferRef?: string; note?: string; actorId?: string } }
  | { type: 'setPurchasing'; payload?: { taobao?: TaobaoInfo; note?: string; actorId?: string } }
  | { type: 'setInProduction'; payload?: { note?: string; actorId?: string } }
  | { type: 'markShipped'; payload: { shipping: ShippingInfo; note?: string; actorId?: string } }
  | { type: 'schedulePickup'; payload: { pickup: PickupInfo; note?: string; actorId?: string } }
  | { type: 'recordDropOff'; payload: { dropoff: DropOffInfo; note?: string; actorId?: string } }
  | { type: 'complete'; payload?: { note?: string; actorId?: string } }
  | { type: 'cancel'; payload?: { note?: string; actorId?: string } }

export async function applyAdminAction(orderId: string, action: AdminAction) {
  const ref = doc(requireDb(), 'orders', orderId)
  const snap = await getDoc(ref)
  if (!snap.exists()) throw new Error('Order not found')
  const data = snap.data() as any

  const now = new Date()
  const history: StatusHistoryEntry[] = data.statusHistory || []

  let updates: any = { updatedAt: serverTimestamp() }
  let nextStatus: OrderStatus | undefined

  switch (action.type) {
    case 'markPaid': {
      nextStatus = 'paid'
      updates.payment = {
        ...(data.payment || {}),
        status: 'paid',
        etransferRef: action.payload.etransferRef || data.payment?.etransferRef,
        receivedAt: now,
      }
      break
    }
    case 'setPurchasing': {
      nextStatus = 'purchasing'
      if (action.payload?.taobao) updates.taobao = action.payload.taobao
      break
    }
    case 'setInProduction': {
      nextStatus = 'in_production'
      break
    }
    case 'markShipped': {
      nextStatus = 'shipped'
      updates.shipping = { ...data.shipping, ...action.payload.shipping, shippedAt: action.payload.shipping.shippedAt || now }
      break
    }
    case 'schedulePickup': {
      nextStatus = 'ready_for_pickup'
      updates.pickup = action.payload.pickup
      break
    }
    case 'recordDropOff': {
      nextStatus = 'dropped_off'
      updates.dropoff = action.payload.dropoff
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
    actorId: (action as any)?.payload?.actorId,
    note: (action as any)?.payload?.note,
  }

  updates.status = nextStatus
  updates.statusHistory = [...history, historyEntry]

  await updateDoc(ref, updates)
  return { ok: true, status: nextStatus }
}
