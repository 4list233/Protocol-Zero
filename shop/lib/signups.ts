// Firestore functions for player sign-ups
import { collection, addDoc, getDocs, query, where, deleteDoc } from 'firebase/firestore'
import { requireDb } from './firebase'

// Get all signups (for listing players)
export async function getAllSignups() {
  const ref = collection(requireDb(), 'signups')
  const snapshot = await getDocs(ref)
  return snapshot.docs.map(doc => doc.data())
}

// Delete a specific user's signup for a date
export async function deleteSignup(userId: string, date: string) {
  const ref = collection(requireDb(), 'signups')
  const q = query(ref, where('userId', '==', userId), where('date', '==', date))
  const snapshot = await getDocs(q)
  // Delete all matching documents (should only be one)
  const deletePromises = snapshot.docs.map(docSnapshot => deleteDoc(docSnapshot.ref))
  await Promise.all(deletePromises)
}

// Delete ALL signups (for resetting data)
export async function deleteAllSignups() {
  const ref = collection(requireDb(), 'signups')
  const snapshot = await getDocs(ref)
  
  const deletePromises = snapshot.docs.map(docSnapshot => deleteDoc(docSnapshot.ref))
  await Promise.all(deletePromises)
  
  console.log(`Deleted ${snapshot.docs.length} signups`)
}

export type Signup = {
  userId?: string // present for authenticated users
  username: string // display name or guest name
  displayName?: string // present for authenticated users
  email?: string // present for authenticated users
  isGuest: boolean
  // For guests added by an authenticated user
  sponsorUserId?: string
  sponsorName?: string
  sponsorEmail?: string | null
  date: string // YYYY-MM-DD
  timestamp: Date
}

// Add a signup for a specific date
// For authenticated users, pass userId, username, displayName, email, isGuest=false
// For guests, pass username, isGuest=true
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
}) {
  const ref = collection(requireDb(), 'signups')
  await addDoc(ref, {
    userId: userId || null,
    username,
    displayName: displayName || null,
    email: email || null,
    isGuest,
    sponsorUserId: sponsorUserId || null,
    sponsorName: sponsorName || null,
    sponsorEmail: sponsorEmail || null,
    date,
    timestamp: new Date(),
  })
}

// Get signup count for a specific date
export async function getSignupCount(date: string): Promise<number> {
  const ref = collection(requireDb(), 'signups')
  const q = query(ref, where('date', '==', date))
  const snapshot = await getDocs(q)
  return snapshot.size
}

// Get all signups for a week (array of dates)
export async function getSignupCountsForWeek(dates: string[]): Promise<number[]> {
  const ref = collection(requireDb(), 'signups')
  const counts: number[] = []
  for (const date of dates) {
    const q = query(ref, where('date', '==', date))
    const snapshot = await getDocs(q)
    counts.push(snapshot.size)
  }
  return counts
}

// Get all guest names for a sponsor user and date
export async function getGuestsForUserDate(sponsorUserId: string, date: string): Promise<string[]> {
  const ref = collection(requireDb(), 'signups')
  const q = query(ref,
    where('sponsorUserId', '==', sponsorUserId),
    where('date', '==', date),
    where('isGuest', '==', true)
  )
  const snapshot = await getDocs(q)
  return snapshot.docs.map(doc => doc.data().username)
}

// Delete a guest signup for a sponsor user and date
export async function deleteGuestSignup(sponsorUserId: string, guestName: string, date: string) {
  const ref = collection(requireDb(), 'signups')
  const q = query(ref,
    where('sponsorUserId', '==', sponsorUserId),
    where('username', '==', guestName),
    where('date', '==', date),
    where('isGuest', '==', true)
  )
  const snapshot = await getDocs(q)
  const deletePromises = snapshot.docs.map(docSnapshot => deleteDoc(docSnapshot.ref))
  await Promise.all(deletePromises)
}
