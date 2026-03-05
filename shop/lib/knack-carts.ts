import {
  getKnackRecords,
  createKnackRecord,
  updateKnackRecord,
} from './knack-client'
import { KNACK_CONFIG, getFieldValue } from './knack-config'
import type { CartItem } from './cart-context'

const CARTS_OBJECT_KEY = KNACK_CONFIG.objectKeys.carts
const CART_FIELDS = KNACK_CONFIG.fields.carts

// ============ TYPES ============

export type CartStatus = 'Active' | 'Abandoned' | 'Converted' | 'Expired'

export type KnackCart = {
  id: string              // Knack record ID
  anonymousId: string | null
  userId: string | null   // Knack user record ID (connection)
  email: string | null
  items: CartItem[]
  itemCount: number
  totalCad: number
  status: CartStatus
  lastActivityAt: Date | null
  reminderSentAt: Date | null
  createdAt: Date
  updatedAt: Date
}

// ============ HELPERS ============

function parseItems(raw: unknown): CartItem[] {
  if (!raw) return []
  try {
    const str = typeof raw === 'string' ? raw : String(raw)
    const parsed = JSON.parse(str)
    return Array.isArray(parsed) ? parsed : []
  } catch {
    return []
  }
}

function parseDate(raw: unknown): Date | null {
  if (!raw) return null
  const d = new Date(String(raw))
  return isNaN(d.getTime()) ? null : d
}

function mapRecordToCart(record: Record<string, unknown>): KnackCart {
  // Connection fields come back as arrays of IDs or objects
  const userRaw = getFieldValue(record, CART_FIELDS.user, 'User')
  let userId: string | null = null
  if (Array.isArray(userRaw) && userRaw.length > 0) {
    userId = typeof userRaw[0] === 'object'
      ? String((userRaw[0] as Record<string, unknown>).id || '')
      : String(userRaw[0])
  } else if (typeof userRaw === 'string' && userRaw) {
    userId = userRaw
  }

  const itemsRaw = getFieldValue(record, CART_FIELDS.itemsJson, 'itemsJson')
  const items = parseItems(itemsRaw)

  return {
    id: String(record.id || ''),
    anonymousId: String(getFieldValue(record, CART_FIELDS.anonymousId, 'anonymousId') || '') || null,
    userId,
    email: String(getFieldValue(record, CART_FIELDS.email, 'Email') || '') || null,
    items,
    itemCount: Number(getFieldValue(record, CART_FIELDS.itemCount, 'ItemCount') || 0),
    totalCad: Number(getFieldValue(record, CART_FIELDS.totalCad, 'TotalCad') || 0),
    status: (getFieldValue(record, CART_FIELDS.status, 'Status') as CartStatus) || 'Active',
    lastActivityAt: parseDate(getFieldValue(record, CART_FIELDS.lastActivityAt, 'LastActivityAt')),
    reminderSentAt: parseDate(getFieldValue(record, CART_FIELDS.reminderSentAt, 'ReminderSentAt')),
    createdAt: parseDate(getFieldValue(record, CART_FIELDS.createdAt, 'CreatedAt')) || new Date(),
    updatedAt: parseDate(getFieldValue(record, CART_FIELDS.updatedAt, 'UpdatedAt')) || new Date(),
  }
}

// ============ QUERIES ============

/**
 * Find cart by anonymous cookie ID
 */
export async function getCartByAnonymousId(anonymousId: string): Promise<KnackCart | null> {
  const records = await getKnackRecords<Record<string, unknown>>(CARTS_OBJECT_KEY, {
    filters: { [CART_FIELDS.anonymousId]: anonymousId },
    perPage: 1,
  })
  if (records.length === 0) return null
  return mapRecordToCart(records[0])
}

/**
 * Find active cart for a logged-in user (by Knack user record ID)
 */
export async function getCartByKnackUserId(knackUserId: string): Promise<KnackCart | null> {
  const records = await getKnackRecords<Record<string, unknown>>(CARTS_OBJECT_KEY, {
    filters: { [CART_FIELDS.user]: knackUserId },
    perPage: 10,
  })
  // Find the most recent active cart
  const active = records
    .map(mapRecordToCart)
    .filter(c => c.status === 'Active')
    .sort((a, b) => b.updatedAt.getTime() - a.updatedAt.getTime())
  return active[0] || null
}

/**
 * Find active cart for a logged-in user (by Firebase UID → Knack user lookup)
 */
export async function getCartByFirebaseUid(
  firebaseUid: string
): Promise<{ cart: KnackCart | null; knackUserId: string | null }> {
  const { getUserByFirebaseUid } = await import('./knack-users')
  const user = await getUserByFirebaseUid(firebaseUid)
  if (!user) return { cart: null, knackUserId: null }

  const cart = await getCartByKnackUserId(user.id)
  return { cart, knackUserId: user.id }
}

/**
 * Get all carts (for admin). Supports optional status filter.
 */
export async function getAllCarts(statusFilter?: CartStatus): Promise<KnackCart[]> {
  const options: Record<string, unknown> = {
    sortField: CART_FIELDS.lastActivityAt,
    sortOrder: 'desc',
    perPage: 100,
  }
  if (statusFilter) {
    options.filters = { [CART_FIELDS.status]: statusFilter }
  }
  const records = await getKnackRecords<Record<string, unknown>>(CARTS_OBJECT_KEY, options)
  return records.map(mapRecordToCart)
}

// ============ MUTATIONS ============

/**
 * Create a new cart record
 */
export async function createCart(data: {
  anonymousId?: string
  knackUserId?: string
  email?: string
  items: CartItem[]
}): Promise<string> {
  const now = new Date().toISOString()
  const totalCad = computeTotal(data.items)
  const itemCount = data.items.reduce((sum, i) => sum + i.quantity, 0)

  const record: Record<string, unknown> = {
    [CART_FIELDS.itemsJson]: JSON.stringify(data.items),
    [CART_FIELDS.itemCount]: itemCount,
    [CART_FIELDS.totalCad]: String(totalCad.toFixed(2)),
    [CART_FIELDS.status]: 'Active',
    [CART_FIELDS.lastActivityAt]: now,
    [CART_FIELDS.createdAt]: now,
    [CART_FIELDS.updatedAt]: now,
  }

  if (data.anonymousId) {
    record[CART_FIELDS.anonymousId] = data.anonymousId
  }
  if (data.knackUserId) {
    record[CART_FIELDS.user] = [data.knackUserId]
  }
  if (data.email) {
    record[CART_FIELDS.email] = data.email
  }

  return await createKnackRecord(CARTS_OBJECT_KEY, record)
}

/**
 * Update an existing cart's items
 */
export async function updateCartItems(
  cartId: string,
  items: CartItem[],
  extraFields?: { email?: string; knackUserId?: string }
): Promise<void> {
  const now = new Date().toISOString()
  const totalCad = computeTotal(items)
  const itemCount = items.reduce((sum, i) => sum + i.quantity, 0)

  const updates: Record<string, unknown> = {
    [CART_FIELDS.itemsJson]: JSON.stringify(items),
    [CART_FIELDS.itemCount]: itemCount,
    [CART_FIELDS.totalCad]: String(totalCad.toFixed(2)),
    [CART_FIELDS.status]: 'Active', // Reset to active on any update
    [CART_FIELDS.lastActivityAt]: now,
    [CART_FIELDS.updatedAt]: now,
  }

  if (extraFields?.email) {
    updates[CART_FIELDS.email] = extraFields.email
  }
  if (extraFields?.knackUserId) {
    updates[CART_FIELDS.user] = [extraFields.knackUserId]
  }

  await updateKnackRecord(CARTS_OBJECT_KEY, cartId, updates)
}

/**
 * Update cart status (e.g., to Abandoned, Converted, Expired)
 */
export async function updateCartStatus(
  cartId: string,
  status: CartStatus,
  extra?: { reminderSentAt?: string }
): Promise<void> {
  const updates: Record<string, unknown> = {
    [CART_FIELDS.status]: status,
    [CART_FIELDS.updatedAt]: new Date().toISOString(),
  }
  if (extra?.reminderSentAt) {
    updates[CART_FIELDS.reminderSentAt] = extra.reminderSentAt
  }
  await updateKnackRecord(CARTS_OBJECT_KEY, cartId, updates)
}

// ============ MERGE ============

/**
 * Merge two carts: union of items by variantId, take max quantity.
 */
export function mergeCarts(cartA: CartItem[], cartB: CartItem[]): CartItem[] {
  const map = new Map<string, CartItem>()

  for (const item of cartA) {
    map.set(item.variantId, { ...item })
  }

  for (const item of cartB) {
    const existing = map.get(item.variantId)
    if (existing) {
      existing.quantity = Math.max(existing.quantity, item.quantity)
    } else {
      map.set(item.variantId, { ...item })
    }
  }

  return Array.from(map.values())
}

// ============ UTILS ============

function computeTotal(items: CartItem[]): number {
  return items.reduce((sum, item) => {
    const price =
      item.itemType === 'addon' && item.addonPrice ? item.addonPrice : item.regularPrice
    return sum + price * item.quantity
  }, 0)
}
