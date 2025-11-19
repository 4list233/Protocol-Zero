// Fetch clips for a specific date from Firestore
import { requireDb } from './firebase'
import { collection, query, where, getDocs } from 'firebase/firestore'

export async function getClipsByDate(date: string) {
  const ref = collection(requireDb(), 'clips')
  // Assuming each clip has a 'date' field in YYYY-MM-DD format
  const q = query(ref, where('date', '==', date))
  const snapshot = await getDocs(q)
  return snapshot.docs.map(doc => ({ id: doc.id, ...doc.data() }))
}
