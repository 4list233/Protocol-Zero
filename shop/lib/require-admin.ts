/**
 * Server-side helper that enforces Firebase-authenticated admin access on API routes.
 *
 * Usage in any API route handler:
 *
 *   const authCheck = await requireAdmin(request)
 *   if (authCheck instanceof NextResponse) return authCheck   // 401 or 403
 *   // authCheck.uid / authCheck.email now available
 */

import { NextResponse } from 'next/server'
import { getFirebaseAdminAuth } from '@/lib/firebase-admin'

// Email whitelist — fallback until every admin has the Firebase custom claim set.
// To set the custom claim run: node scripts/set-admin-claim.js <email>
const ADMIN_EMAILS = ['forestli009@gmail.com']

type AdminUser = {
  uid: string
  email: string
}

export async function requireAdmin(
  request: Request
): Promise<AdminUser | NextResponse> {
  const authHeader = request.headers.get('Authorization')

  if (!authHeader?.startsWith('Bearer ')) {
    return NextResponse.json(
      { error: 'Unauthorized — missing Bearer token' },
      { status: 401 }
    )
  }

  const token = authHeader.slice(7)

  try {
    const adminAuth = getFirebaseAdminAuth()
    const decoded = await adminAuth.verifyIdToken(token)

    // Accept either the custom claim OR the email whitelist
    const email = (decoded.email ?? '').toLowerCase()
    const hasAdminClaim = decoded.admin === true
    const isWhitelisted = ADMIN_EMAILS.includes(email)

    if (!hasAdminClaim && !isWhitelisted) {
      return NextResponse.json(
        { error: 'Forbidden — admin access required' },
        { status: 403 }
      )
    }

    return { uid: decoded.uid, email }
  } catch {
    return NextResponse.json(
      { error: 'Unauthorized — invalid or expired token' },
      { status: 401 }
    )
  }
}
