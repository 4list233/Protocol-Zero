// Knack-based user operations
import {
  getKnackRecords,
  getKnackRecord,
  createKnackRecord,
  updateKnackRecord,
  isKnackConfigured,
} from './knack-client'
import { KNACK_CONFIG, getFieldValue } from './knack-config'

// Knack object key for users
const USERS_OBJECT_KEY = KNACK_CONFIG.objectKeys.users
const USER_FIELDS = KNACK_CONFIG.fields.users

// User type matching Knack structure
export type KnackUser = {
  id: string // Knack record ID
  displayName: string
  name: string
  userId: string // Firebase Auth UID or generated ID
  role: 'customer' | 'admin' | 'staff'
  email: string
  userStatus: 'active' | 'inactive' | 'pending'
  phone?: string
  isActive: boolean
  createdAt: Date
  updatedAt: Date
}

// Map Knack record to User type
function mapKnackRecordToUser(record: Record<string, unknown>): KnackUser {
  const createdAtValue = getFieldValue(record, USER_FIELDS.createdAt, 'Created At')
  const updatedAtValue = getFieldValue(record, USER_FIELDS.updatedAt, 'Updated At')
  const isActiveValue = getFieldValue(record, USER_FIELDS.isActive, 'Is Active')

  return {
    id: String(record.id || ''),
    displayName: String(getFieldValue(record, USER_FIELDS.displayName, 'Display Name') || ''),
    name: String(getFieldValue(record, USER_FIELDS.name, 'Name') || ''),
    userId: String(getFieldValue(record, USER_FIELDS.userId, 'User ID') || ''),
    role: (getFieldValue(record, USER_FIELDS.role, 'Role') as KnackUser['role']) || 'customer',
    email: String(getFieldValue(record, USER_FIELDS.email, 'Email') || ''),
    userStatus: (getFieldValue(record, USER_FIELDS.userStatus, 'User Status') as KnackUser['userStatus']) || 'active',
    phone: getFieldValue(record, USER_FIELDS.phone, 'Phone')
      ? String(getFieldValue(record, USER_FIELDS.phone, 'Phone'))
      : undefined,
    isActive: isActiveValue === true || isActiveValue === 'Yes' || isActiveValue === 'true',
    createdAt: createdAtValue ? new Date(String(createdAtValue)) : new Date(),
    updatedAt: updatedAtValue ? new Date(String(updatedAtValue)) : new Date(),
  }
}

/**
 * Create a new user in Knack
 */
export async function createKnackUser(data: {
  displayName: string
  name: string
  userId: string // Firebase Auth UID or generated guest ID
  email: string
  password?: string // Optional - for Knack's own auth if needed
  phone?: string
  isGuest?: boolean
}): Promise<string> {
  if (!isKnackConfigured()) {
    throw new Error('Knack is not configured')
  }

  const now = new Date().toISOString()
  
  // Parse name into first/last for Knack Person field (field_71)
  // Person fields require: { first: "First", last: "Last" }
  const nameParts = data.name.trim().split(' ')
  const firstName = nameParts[0] || data.displayName || 'Guest'
  const lastName = nameParts.slice(1).join(' ') || ''

  const record: Record<string, unknown> = {
    [USER_FIELDS.displayName]: data.displayName,
    // Person field format for field_71
    [USER_FIELDS.name]: {
      first: firstName,
      last: lastName,
    },
    [USER_FIELDS.userId]: data.userId,
    [USER_FIELDS.role]: 'Customer', // Multiple Choice field - capitalize
    [USER_FIELDS.email]: data.email,
    [USER_FIELDS.userStatus]: 'Active', // Multiple Choice field - capitalize
    [USER_FIELDS.isActive]: true,
    [USER_FIELDS.createdAt]: now,
    [USER_FIELDS.updatedAt]: now,
  }

  // Optional fields
  if (data.password) {
    record[USER_FIELDS.password] = data.password
  }
  if (data.phone) {
    record[USER_FIELDS.phone] = data.phone
  }

  return await createKnackRecord(USERS_OBJECT_KEY, record)
}

/**
 * Get user by Firebase Auth UID
 */
export async function getUserByFirebaseUid(uid: string): Promise<KnackUser | null> {
  if (!isKnackConfigured()) {
    throw new Error('Knack is not configured')
  }

  const records = await getKnackRecords<Record<string, unknown>>(USERS_OBJECT_KEY, {
    filters: { [USER_FIELDS.userId]: uid },
  })

  if (records.length === 0) return null
  return mapKnackRecordToUser(records[0])
}

/**
 * Get user by email
 */
export async function getUserByEmail(email: string): Promise<KnackUser | null> {
  if (!isKnackConfigured()) {
    throw new Error('Knack is not configured')
  }

  const records = await getKnackRecords<Record<string, unknown>>(USERS_OBJECT_KEY, {
    filters: { [USER_FIELDS.email]: email },
  })

  if (records.length === 0) return null
  return mapKnackRecordToUser(records[0])
}

/**
 * Get user by Knack record ID
 */
export async function getUserById(id: string): Promise<KnackUser | null> {
  if (!isKnackConfigured()) {
    throw new Error('Knack is not configured')
  }

  const record = await getKnackRecord<Record<string, unknown>>(USERS_OBJECT_KEY, id)
  if (!record) return null

  return mapKnackRecordToUser(record)
}

/**
 * Update user in Knack
 */
export async function updateUser(
  id: string,
  data: Partial<{
    displayName: string
    name: string
    phone: string
    userStatus: 'active' | 'inactive' | 'pending'
    isActive: boolean
  }>
): Promise<void> {
  if (!isKnackConfigured()) {
    throw new Error('Knack is not configured')
  }

  const updates: Record<string, unknown> = {
    [USER_FIELDS.updatedAt]: new Date().toISOString(),
  }

  if (data.displayName !== undefined) {
    updates[USER_FIELDS.displayName] = data.displayName
  }
  if (data.name !== undefined) {
    updates[USER_FIELDS.name] = data.name
  }
  if (data.phone !== undefined) {
    updates[USER_FIELDS.phone] = data.phone
  }
  if (data.userStatus !== undefined) {
    // Capitalize for Multiple Choice field
    updates[USER_FIELDS.userStatus] = data.userStatus.charAt(0).toUpperCase() + data.userStatus.slice(1)
  }
  if (data.isActive !== undefined) {
    updates[USER_FIELDS.isActive] = data.isActive
  }

  await updateKnackRecord(USERS_OBJECT_KEY, id, updates)
}

