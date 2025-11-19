// Firebase operations for clips functionality
import {
  collection,
  addDoc,
  getDocs,
  doc,
  updateDoc,
  deleteDoc,
  query,
  orderBy,
  where,
  Timestamp,
  increment,
  serverTimestamp,
} from 'firebase/firestore'
import { db } from './firebase'

// Types
export type ClipTag = 'speedsoft' | 'milsim' | 'multikill' | 'funny' | 'tutorial' | 'gear-review'

export interface ClipData {
  userId: string
  username: string
  userAvatar: string
  title: string
  description: string
  youtubeUrl: string
  youtubeId: string
  tags: ClipTag[]
  likes: number
  likedBy: string[]
  comments: number
  timestamp: Date | Timestamp
  date?: string
  videoFile?: string
}

export interface Clip extends ClipData {
  id: string
  isLiked?: boolean
}

function requireDb() {
  if (!db) {
    throw new Error('Firebase is not configured. Please set NEXT_PUBLIC_FIREBASE_* env vars.')
  }
  return db
}

// Add a new clip
export async function addClip(
  clipData: Omit<ClipData, 'likes' | 'likedBy' | 'comments' | 'timestamp'>
): Promise<string> {
  const docRef = await addDoc(collection(requireDb(), 'clips'), {
    ...clipData,
    likes: 0,
    likedBy: [],
    comments: 0,
    timestamp: serverTimestamp(),
  })
  return docRef.id
}

// Get all clips
export async function getClips(tags?: ClipTag[]): Promise<Clip[]> {
  const q = query(collection(requireDb(), 'clips'), orderBy('timestamp', 'desc'))
  const querySnapshot = await getDocs(q)
  const clips: Clip[] = []

  querySnapshot.forEach((docSnap) => {
    const data = docSnap.data() as ClipData
    if (tags && tags.length > 0) {
      const hasMatchingTag = tags.some((tag) => data.tags.includes(tag))
      if (!hasMatchingTag) return
    }
    clips.push({
      id: docSnap.id,
      ...data,
      timestamp: data.timestamp instanceof Timestamp ? data.timestamp.toDate() : new Date(data.timestamp),
    })
  })
  return clips
}

// Get clips by user
export async function getUserClips(userId: string): Promise<Clip[]> {
  const q = query(collection(requireDb(), 'clips'), where('userId', '==', userId), orderBy('timestamp', 'desc'))
  const querySnapshot = await getDocs(q)
  const clips: Clip[] = []
  querySnapshot.forEach((docSnap) => {
    const data = docSnap.data() as ClipData
    clips.push({
      id: docSnap.id,
      ...data,
      timestamp: data.timestamp instanceof Timestamp ? data.timestamp.toDate() : new Date(data.timestamp),
    })
  })
  return clips
}

// Get clips by date
export async function getClipsByDate(date: string): Promise<Clip[]> {
  const q = query(
    collection(requireDb(), 'clips'),
    where('date', '==', date),
    orderBy('timestamp', 'desc')
  )
  const querySnapshot = await getDocs(q)
  const clips: Clip[] = []
  querySnapshot.forEach((docSnap) => {
    const data = docSnap.data() as ClipData
    clips.push({
      id: docSnap.id,
      ...data,
      timestamp: data.timestamp instanceof Timestamp ? data.timestamp.toDate() : new Date(data.timestamp),
    })
  })
  return clips
}

// Update a clip
export async function updateClip(clipId: string, updates: Partial<ClipData>): Promise<void> {
  const clipRef = doc(requireDb(), 'clips', clipId)
  await updateDoc(clipRef, updates)
}

// Delete a clip
export async function deleteClip(clipId: string): Promise<void> {
  await deleteDoc(doc(requireDb(), 'clips', clipId))
}

// Toggle like on a clip
export async function toggleLike(
  clipId: string,
  userId: string
): Promise<{ liked: boolean; newLikeCount: number }> {
  const clipRef = doc(requireDb(), 'clips', clipId)
  // Get current clip doc via query by id
  const clipDoc = await getDocs(query(collection(requireDb(), 'clips'), where('__name__', '==', clipId)))
  if (clipDoc.empty) {
    throw new Error('Clip not found')
  }
  const clipData = clipDoc.docs[0].data() as ClipData
  const likedBy = clipData.likedBy || []
  const isLiked = likedBy.includes(userId)

  if (isLiked) {
    await updateDoc(clipRef, {
      likedBy: likedBy.filter((id) => id !== userId),
      likes: increment(-1),
    })
    return { liked: false, newLikeCount: clipData.likes - 1 }
  } else {
    await updateDoc(clipRef, {
      likedBy: [...likedBy, userId],
      likes: increment(1),
    })
    return { liked: true, newLikeCount: clipData.likes + 1 }
  }
}

// Mark liked clips helper
export function markClipsAsLiked(clips: Clip[], userId: string): Clip[] {
  return clips.map((clip) => ({
    ...clip,
    isLiked: clip.likedBy?.includes(userId) || false,
  }))
}

// ==================== STORAGE OPERATIONS ====================
// These functions are commented out because they require Firebase Storage (Blaze plan)
// Current implementation uses YouTube embeds only, which is free!
// Uncomment these if you upgrade to Blaze plan and want direct video uploads

/**
 * Upload a video file to Firebase Storage
 * @param file - The video file to upload
 * @param userId - The user ID (for organizing files)
 * @returns The download URL and storage path
 */
/* 
export async function uploadClipVideo(
  file: File, 
  userId: string
): Promise<{ downloadURL: string; storagePath: string }> {
  try {
    // Create a unique filename
    const timestamp = Date.now()
    const fileName = `${userId}_${timestamp}_${file.name}`
    const storagePath = `clips/${userId}/${fileName}`
    const storageRef = ref(storage, storagePath)
    
    // Upload the file
    const snapshot = await uploadBytes(storageRef, file)
    console.log('Video uploaded successfully')
    
    // Get the download URL
    const downloadURL = await getDownloadURL(snapshot.ref)
    
    return { downloadURL, storagePath }
  } catch (error) {
    console.error("Error uploading video:", error)
    throw error
  }
}
*/

/**
 * Delete a video file from Firebase Storage
 */
/* 
export async function deleteClipVideo(storagePath: string): Promise<void> {
  try {
    const storageRef = ref(storage, storagePath)
    await deleteObject(storageRef)
    console.log('Video deleted successfully')
  } catch (error) {
    console.error("Error deleting video:", error)
    throw error
  }
}
*/

/**
 * Upload a thumbnail image to Firebase Storage
 */
/* 
export async function uploadClipThumbnail(
  file: File,
  userId: string
): Promise<{ downloadURL: string; storagePath: string }> {
  try {
    const timestamp = Date.now()
    const fileName = `${userId}_${timestamp}_thumb_${file.name}`
    const storagePath = `clips/thumbnails/${userId}/${fileName}`
    const storageRef = ref(storage, storagePath)
    
    const snapshot = await uploadBytes(storageRef, file)
    const downloadURL = await getDownloadURL(snapshot.ref)
    
    return { downloadURL, storagePath }
  } catch (error) {
    console.error("Error uploading thumbnail:", error)
    throw error
  }
}
*/

// ==================== HELPER FUNCTIONS ====================

/**
 * Extract YouTube video ID from various URL formats
 */
export function extractYouTubeId(url: string): string | null {
  const regExp = /^.*((youtu.be\/)|(v\/)|(\/u\/\w\/)|(embed\/)|(watch\?))\??v?=?([^#&?]*).*/
  const match = url.match(regExp)
  return match && match[7].length === 11 ? match[7] : null
}

/**
 * Validate YouTube URL
 */
export function isValidYouTubeUrl(url: string): boolean {
  return extractYouTubeId(url) !== null
}

/**
 * Format timestamp to relative time (e.g., "2h ago")
 */
export function formatTimeAgo(date: Date): string {
  const seconds = Math.floor((new Date().getTime() - date.getTime()) / 1000)
  
  if (seconds < 60) return `${seconds}s ago`
  if (seconds < 3600) return `${Math.floor(seconds / 60)}m ago`
  if (seconds < 86400) return `${Math.floor(seconds / 3600)}h ago`
  if (seconds < 604800) return `${Math.floor(seconds / 86400)}d ago`
  return date.toLocaleDateString()
}
