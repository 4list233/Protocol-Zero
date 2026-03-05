import { NextRequest, NextResponse } from 'next/server'
import { getKnackRecords, updateKnackRecord } from '@/lib/knack-client'
import { KNACK_CONFIG } from '@/lib/knack-config'

export const dynamic = 'force-dynamic'

const ABANDON_THRESHOLD_MS = 2 * 24 * 60 * 60 * 1000 // 2 days

/**
 * GET /api/cron/abandoned-carts
 * Marks active carts as abandoned if idle for >2 days.
 * Called by Vercel Cron daily at 9am UTC.
 * Protected by CRON_SECRET env var.
 */
export async function GET(request: NextRequest) {
  // Verify cron secret (Vercel sets this automatically for cron jobs)
  const authHeader = request.headers.get('Authorization')
  const cronSecret = process.env.CRON_SECRET

  if (cronSecret && authHeader !== `Bearer ${cronSecret}`) {
    return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })
  }

  try {
    const CART_FIELDS = KNACK_CONFIG.fields.carts
    const CARTS_OBJECT_KEY = KNACK_CONFIG.objectKeys.carts

    // Fetch all active carts
    const records = await getKnackRecords<Record<string, unknown>>(CARTS_OBJECT_KEY, {
      filters: { [CART_FIELDS.status]: 'Active' },
      perPage: 200,
    })

    const now = Date.now()
    let abandonedCount = 0
    let expiredCount = 0

    for (const record of records) {
      const lastActivity = record[CART_FIELDS.lastActivityAt]
      if (!lastActivity) continue

      const lastActivityTime = new Date(String(lastActivity)).getTime()
      if (isNaN(lastActivityTime)) continue

      const idleTime = now - lastActivityTime
      if (idleTime < ABANDON_THRESHOLD_MS) continue

      // Check if items exist (don't abandon empty carts — just expire them)
      const itemsJson = String(record[CART_FIELDS.itemsJson] || '')
      let hasItems = false
      try {
        const items = JSON.parse(itemsJson)
        hasItems = Array.isArray(items) && items.length > 0
      } catch {
        /* empty */
      }

      const newStatus = hasItems ? 'Abandoned' : 'Expired'
      const updates: Record<string, unknown> = {
        [CART_FIELDS.status]: newStatus,
        [CART_FIELDS.updatedAt]: new Date().toISOString(),
      }

      // Only set reminderSentAt for abandoned (not expired)
      if (newStatus === 'Abandoned') {
        updates[CART_FIELDS.reminderSentAt] = new Date().toISOString()
        abandonedCount++
      } else {
        expiredCount++
      }

      await updateKnackRecord(CARTS_OBJECT_KEY, String(record.id), updates)
    }

    return NextResponse.json({
      processed: records.length,
      abandoned: abandonedCount,
      expired: expiredCount,
      timestamp: new Date().toISOString(),
    })
  } catch (error) {
    console.error('[Abandoned Carts Cron] Error:', error)
    return NextResponse.json({ error: 'Cron job failed' }, { status: 500 })
  }
}
