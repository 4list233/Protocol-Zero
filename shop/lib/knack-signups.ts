// Knack-based signups operations (replaces Firestore signups)
import {
  getKnackRecords,
  createKnackRecord,
  deleteKnackRecord,
  isKnackConfigured,
} from './knack-client'
import { KNACK_CONFIG, getFieldValue } from './knack-config'
import type { Signup } from './signups'

// Knack object key for signups (from config or env)
const SIGNUPS_OBJECT_KEY = KNACK_CONFIG.objectKeys.signups
const SIGNUP_FIELDS = KNACK_CONFIG.fields.signups

// Map Knack record to Signup type
function mapKnackRecordToSignup(record: Record<string, unknown>): Signup {
  const timestampValue = getFieldValue(record, SIGNUP_FIELDS.timestamp, 'Timestamp')
  const timestamp = timestampValue 
    ? new Date(String(timestampValue))
    : new Date()

  return {
    userId: getFieldValue(record, SIGNUP_FIELDS.userId, 'User ID') 
      ? String(getFieldValue(record, SIGNUP_FIELDS.userId, 'User ID'))
      : undefined,
    username: String(getFieldValue(record, SIGNUP_FIELDS.username, 'Username') || ''),
    email: getFieldValue(record, SIGNUP_FIELDS.email, 'Email')
      ? String(getFieldValue(record, SIGNUP_FIELDS.email, 'Email'))
      : undefined,
    isGuest: Boolean(getFieldValue(record, SIGNUP_FIELDS.isGuest, 'Is Guest') || false),
    sponsorUserId: getFieldValue(record, SIGNUP_FIELDS.sponsorUserId, 'Sponsor User ID')
      ? String(getFieldValue(record, SIGNUP_FIELDS.sponsorUserId, 'Sponsor User ID'))
      : undefined,
    date: String(getFieldValue(record, SIGNUP_FIELDS.date, 'Date') || ''),
    timestamp,
  }
}

/**
 * Get all signups (for listing players)
 */
export async function getAllSignups(): Promise<Signup[]> {
  if (!isKnackConfigured()) {
    throw new Error('Knack is not configured. Please set KNACK_APPLICATION_ID and KNACK_REST_API_KEY.')
  }

  const records = await getKnackRecords<Record<string, unknown>>(SIGNUPS_OBJECT_KEY, {
    sortField: SIGNUP_FIELDS.timestamp,
    sortOrder: 'desc',
  })

  return records.map(mapKnackRecordToSignup)
}

/**
 * Add a signup for a specific date
 */
export async function addSignup({
  userId,
  username,
  displayName,
  email,
  isGuest,
  sponsorUserId,
  sponsorName,
  sponsorEmail,
  date,
}: {
  userId?: string
  username: string
  displayName?: string
  email?: string
  isGuest: boolean
  sponsorUserId?: string
  sponsorName?: string
  sponsorEmail?: string | null
  date: string
}): Promise<void> {
  if (!isKnackConfigured()) {
    throw new Error('Knack is not configured. Please set KNACK_APPLICATION_ID and KNACK_REST_API_KEY.')
  }

  const recordData: Record<string, unknown> = {}
  recordData[SIGNUP_FIELDS.userId] = userId || null
  recordData[SIGNUP_FIELDS.username] = username
  recordData[SIGNUP_FIELDS.email] = email || null
  recordData[SIGNUP_FIELDS.isGuest] = isGuest
  recordData[SIGNUP_FIELDS.sponsorUserId] = sponsorUserId || null
  recordData[SIGNUP_FIELDS.date] = date
  recordData[SIGNUP_FIELDS.timestamp] = new Date().toISOString()

  await createKnackRecord(SIGNUPS_OBJECT_KEY, recordData)
}

/**
 * Get signup count for a specific date
 */
export async function getSignupCount(date: string): Promise<number> {
  if (!isKnackConfigured()) {
    throw new Error('Knack is not configured. Please set KNACK_APPLICATION_ID and KNACK_REST_API_KEY.')
  }

  const records = await getKnackRecords<Record<string, unknown>>(SIGNUPS_OBJECT_KEY, {
    filters: { [SIGNUP_FIELDS.date]: date },
  })

  return records.length
}

/**
 * Get all signups for a week (array of dates)
 */
export async function getSignupCountsForWeek(dates: string[]): Promise<number[]> {
  if (!isKnackConfigured()) {
    throw new Error('Knack is not configured. Please set KNACK_APPLICATION_ID and KNACK_REST_API_KEY.')
  }

  const counts: number[] = []
  for (const date of dates) {
    const count = await getSignupCount(date)
    counts.push(count)
  }
  return counts
}

/**
 * Delete a specific user's signup for a date
 */
export async function deleteSignup(userId: string, date: string): Promise<void> {
  if (!isKnackConfigured()) {
    throw new Error('Knack is not configured. Please set KNACK_APPLICATION_ID and KNACK_REST_API_KEY.')
  }

  const records = await getKnackRecords<Record<string, unknown>>(SIGNUPS_OBJECT_KEY, {
    filters: { 
      [SIGNUP_FIELDS.userId]: userId,
      [SIGNUP_FIELDS.date]: date,
    },
  })

  // Delete all matching records
  await Promise.all(records.map((record) => deleteKnackRecord(SIGNUPS_OBJECT_KEY, String(record.id))))
}

/**
 * Delete ALL signups (for resetting data)
 */
export async function deleteAllSignups(): Promise<void> {
  if (!isKnackConfigured()) {
    throw new Error('Knack is not configured. Please set KNACK_APPLICATION_ID and KNACK_REST_API_KEY.')
  }

  const records = await getKnackRecords<Record<string, unknown>>(SIGNUPS_OBJECT_KEY)

  await Promise.all(records.map((record) => deleteKnackRecord(SIGNUPS_OBJECT_KEY, String(record.id))))
  
  console.log(`Deleted ${records.length} signups`)
}

/**
 * Get all guest names for a sponsor user and date
 */
export async function getGuestsForUserDate(sponsorUserId: string, date: string): Promise<string[]> {
  if (!isKnackConfigured()) {
    throw new Error('Knack is not configured. Please set KNACK_APPLICATION_ID and KNACK_REST_API_KEY.')
  }

  const records = await getKnackRecords<Record<string, unknown>>(SIGNUPS_OBJECT_KEY, {
    filters: {
      [SIGNUP_FIELDS.sponsorUserId]: sponsorUserId,
      [SIGNUP_FIELDS.date]: date,
      [SIGNUP_FIELDS.isGuest]: true,
    },
  })

  return records.map((record) => String(getFieldValue(record, SIGNUP_FIELDS.username, 'Username') || ''))
}

/**
 * Delete a guest signup for a sponsor user and date
 */
export async function deleteGuestSignup(sponsorUserId: string, guestName: string, date: string): Promise<void> {
  if (!isKnackConfigured()) {
    throw new Error('Knack is not configured. Please set KNACK_APPLICATION_ID and KNACK_REST_API_KEY.')
  }

  const records = await getKnackRecords<Record<string, unknown>>(SIGNUPS_OBJECT_KEY, {
    filters: {
      [SIGNUP_FIELDS.sponsorUserId]: sponsorUserId,
      [SIGNUP_FIELDS.username]: guestName,
      [SIGNUP_FIELDS.date]: date,
      [SIGNUP_FIELDS.isGuest]: true,
    },
  })

  await Promise.all(records.map((record) => deleteKnackRecord(SIGNUPS_OBJECT_KEY, String(record.id))))
}








