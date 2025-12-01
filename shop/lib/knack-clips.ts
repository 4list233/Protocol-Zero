// Knack-based clips operations (replaces Firestore clips)
import {
  getKnackRecords,
  getKnackRecord,
  createKnackRecord,
  updateKnackRecord,
  deleteKnackRecord,
  isKnackConfigured,
} from './knack-client'
import { KNACK_CONFIG, getFieldValue } from './knack-config'
import type { Clip, ClipData, ClipTag } from './clips'

// Knack object key for clips (from config or env)
const CLIPS_OBJECT_KEY = KNACK_CONFIG.objectKeys.clips
const CLIP_FIELDS = KNACK_CONFIG.fields.clips

// Map Knack record to Clip type
function mapKnackRecordToClip(record: Record<string, unknown>): Clip {
  // Parse JSON fields
  let tags: ClipTag[] = []
  try {
    const tagsField = getFieldValue(record, CLIP_FIELDS.tags, 'Tags')
    if (typeof tagsField === 'string') {
      tags = JSON.parse(tagsField)
    } else if (Array.isArray(tagsField)) {
      tags = tagsField as ClipTag[]
    }
  } catch {
    tags = []
  }

  let likedBy: string[] = []
  try {
    const likedByField = getFieldValue(record, CLIP_FIELDS.likedBy, 'Liked By')
    if (typeof likedByField === 'string') {
      likedBy = JSON.parse(likedByField)
    } else if (Array.isArray(likedByField)) {
      likedBy = likedByField.map((item: unknown) => String(item))
    }
  } catch {
    likedBy = []
  }

  const timestampValue = getFieldValue(record, CLIP_FIELDS.timestamp, 'Timestamp')
  const timestamp = timestampValue 
    ? new Date(String(timestampValue))
    : new Date()

  return {
    id: String(record.id || ''),
    userId: String(getFieldValue(record, CLIP_FIELDS.userId, 'User ID') || ''),
    username: String(getFieldValue(record, CLIP_FIELDS.username, 'Username') || ''),
    userAvatar: String(getFieldValue(record, CLIP_FIELDS.userAvatar, 'User Avatar') || ''),
    title: String(getFieldValue(record, CLIP_FIELDS.title, 'Title') || ''),
    description: String(getFieldValue(record, CLIP_FIELDS.description, 'Description') || ''),
    youtubeUrl: String(getFieldValue(record, CLIP_FIELDS.youtubeUrl, 'YouTube URL') || ''),
    youtubeId: String(getFieldValue(record, CLIP_FIELDS.youtubeId, 'YouTube ID') || ''),
    tags,
    likes: Number(getFieldValue(record, CLIP_FIELDS.likes, 'Likes') || 0),
    likedBy,
    comments: Number(getFieldValue(record, CLIP_FIELDS.comments, 'Comments') || 0),
    timestamp,
    date: getFieldValue(record, CLIP_FIELDS.date, 'Date') ? String(getFieldValue(record, CLIP_FIELDS.date, 'Date')) : undefined,
  }
}

/**
 * Add a new clip
 */
export async function addClip(
  clipData: Omit<ClipData, 'likes' | 'likedBy' | 'comments' | 'timestamp'>
): Promise<string> {
  if (!isKnackConfigured()) {
    throw new Error('Knack is not configured. Please set KNACK_APPLICATION_ID and KNACK_REST_API_KEY.')
  }

  const recordData: Record<string, unknown> = {}
  recordData[CLIP_FIELDS.userId] = clipData.userId
  recordData[CLIP_FIELDS.username] = clipData.username
  recordData[CLIP_FIELDS.userAvatar] = clipData.userAvatar
  recordData[CLIP_FIELDS.title] = clipData.title
  recordData[CLIP_FIELDS.description] = clipData.description || ''
  recordData[CLIP_FIELDS.youtubeUrl] = clipData.youtubeUrl
  recordData[CLIP_FIELDS.youtubeId] = clipData.youtubeId
  recordData[CLIP_FIELDS.tags] = JSON.stringify(clipData.tags || [])
  recordData[CLIP_FIELDS.likes] = 0
  recordData[CLIP_FIELDS.likedBy] = JSON.stringify([])
  recordData[CLIP_FIELDS.comments] = 0
  recordData[CLIP_FIELDS.timestamp] = new Date().toISOString()
  if (clipData.date) {
    recordData[CLIP_FIELDS.date] = clipData.date
  }

  const recordId = await createKnackRecord(CLIPS_OBJECT_KEY, recordData)
  return recordId
}

/**
 * Get all clips
 */
export async function getClips(tags?: ClipTag[]): Promise<Clip[]> {
  if (!isKnackConfigured()) {
    throw new Error('Knack is not configured. Please set KNACK_APPLICATION_ID and KNACK_REST_API_KEY.')
  }

  const records = await getKnackRecords<Record<string, unknown>>(CLIPS_OBJECT_KEY, {
    sortField: CLIP_FIELDS.timestamp,
    sortOrder: 'desc',
  })

  let clips = records.map(mapKnackRecordToClip)

  // Filter by tags if provided
  if (tags && tags.length > 0) {
    clips = clips.filter((clip) => tags.some((tag) => clip.tags.includes(tag)))
  }

  return clips
}

/**
 * Get clips by user
 */
export async function getUserClips(userId: string): Promise<Clip[]> {
  if (!isKnackConfigured()) {
    throw new Error('Knack is not configured. Please set KNACK_APPLICATION_ID and KNACK_REST_API_KEY.')
  }

  const records = await getKnackRecords<Record<string, unknown>>(CLIPS_OBJECT_KEY, {
    filters: { [CLIP_FIELDS.userId]: userId },
    sortField: CLIP_FIELDS.timestamp,
    sortOrder: 'desc',
  })

  return records.map(mapKnackRecordToClip)
}

/**
 * Get clips by date
 */
export async function getClipsByDate(date: string): Promise<Clip[]> {
  if (!isKnackConfigured()) {
    throw new Error('Knack is not configured. Please set KNACK_APPLICATION_ID and KNACK_REST_API_KEY.')
  }

  const records = await getKnackRecords<Record<string, unknown>>(CLIPS_OBJECT_KEY, {
    filters: { [CLIP_FIELDS.date]: date },
    sortField: CLIP_FIELDS.timestamp,
    sortOrder: 'desc',
  })

  return records.map(mapKnackRecordToClip)
}

/**
 * Update a clip
 */
export async function updateClip(clipId: string, updates: Partial<ClipData>): Promise<void> {
  if (!isKnackConfigured()) {
    throw new Error('Knack is not configured. Please set KNACK_APPLICATION_ID and KNACK_REST_API_KEY.')
  }

  const updateData: Record<string, unknown> = {}

  if (updates.title !== undefined) updateData[CLIP_FIELDS.title] = updates.title
  if (updates.description !== undefined) updateData[CLIP_FIELDS.description] = updates.description
  if (updates.youtubeUrl !== undefined) updateData[CLIP_FIELDS.youtubeUrl] = updates.youtubeUrl
  if (updates.youtubeId !== undefined) updateData[CLIP_FIELDS.youtubeId] = updates.youtubeId
  if (updates.tags !== undefined) updateData[CLIP_FIELDS.tags] = JSON.stringify(updates.tags)
  if (updates.likes !== undefined) updateData[CLIP_FIELDS.likes] = updates.likes
  if (updates.likedBy !== undefined) updateData[CLIP_FIELDS.likedBy] = JSON.stringify(updates.likedBy)
  if (updates.comments !== undefined) updateData[CLIP_FIELDS.comments] = updates.comments
  if (updates.date !== undefined) updateData[CLIP_FIELDS.date] = updates.date

  await updateKnackRecord(CLIPS_OBJECT_KEY, clipId, updateData)
}

/**
 * Delete a clip
 */
export async function deleteClip(clipId: string): Promise<void> {
  if (!isKnackConfigured()) {
    throw new Error('Knack is not configured. Please set KNACK_APPLICATION_ID and KNACK_REST_API_KEY.')
  }

  await deleteKnackRecord(CLIPS_OBJECT_KEY, clipId)
}

/**
 * Toggle like on a clip
 */
export async function toggleLike(
  clipId: string,
  userId: string
): Promise<{ liked: boolean; newLikeCount: number }> {
  if (!isKnackConfigured()) {
    throw new Error('Knack is not configured. Please set KNACK_APPLICATION_ID and KNACK_REST_API_KEY.')
  }

  const clip = await getKnackRecord<Record<string, unknown>>(CLIPS_OBJECT_KEY, clipId)
  if (!clip) {
    throw new Error('Clip not found')
  }

  const likedByField = getFieldValue(clip, CLIP_FIELDS.likedBy, 'Liked By')
  let likedBy: string[] = []
  try {
    if (typeof likedByField === 'string') {
      likedBy = JSON.parse(likedByField)
    } else if (Array.isArray(likedByField)) {
      likedBy = likedByField.map((item: unknown) => String(item))
    }
  } catch {
    likedBy = []
  }

  const currentLikes = Number(getFieldValue(clip, CLIP_FIELDS.likes, 'Likes') || 0)
  const isLiked = likedBy.includes(userId)

  if (isLiked) {
    likedBy = likedBy.filter((id) => id !== userId)
    await updateKnackRecord(CLIPS_OBJECT_KEY, clipId, {
      [CLIP_FIELDS.likedBy]: JSON.stringify(likedBy),
      [CLIP_FIELDS.likes]: currentLikes - 1,
    })
    return { liked: false, newLikeCount: currentLikes - 1 }
  } else {
    likedBy.push(userId)
    await updateKnackRecord(CLIPS_OBJECT_KEY, clipId, {
      [CLIP_FIELDS.likedBy]: JSON.stringify(likedBy),
      [CLIP_FIELDS.likes]: currentLikes + 1,
    })
    return { liked: true, newLikeCount: currentLikes + 1 }
  }
}








