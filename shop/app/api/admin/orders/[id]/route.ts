import { NextRequest, NextResponse } from 'next/server'
import { ADMIN_EMAILS } from '@/lib/constants'
import { getOrderById, applyAdminAction, type AdminAction } from '@/lib/orders'

// Helper to verify Firebase Auth from request
async function verifyFirebaseAuth(req: NextRequest): Promise<{ email: string; uid: string } | null> {
  const authHeader = req.headers.get('authorization')
  if (!authHeader || !authHeader.startsWith('Bearer ')) {
    return null
  }

  const idToken = authHeader.substring(7)
  
  // For now, we'll accept the email from a custom header if token verification isn't set up
  // In production, you should verify the ID token using Firebase Admin SDK
  const email = req.headers.get('x-user-email')
  const uid = req.headers.get('x-user-id')
  
  if (!email || !uid) {
    return null
  }

  return { email, uid }
}

function unauthorized() {
  return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })
}

export async function GET(req: NextRequest, { params }: { params: { id: string } }) {
  const auth = await verifyFirebaseAuth(req)
  if (!auth || !ADMIN_EMAILS.includes(auth.email)) return unauthorized()

  try {
    const order = await getOrderById(params.id)
    if (!order) return NextResponse.json({ error: 'Not found' }, { status: 404 })
    return NextResponse.json({ order })
  } catch (e: any) {
    return NextResponse.json({ error: e.message || 'Failed to fetch order' }, { status: 500 })
  }
}

export async function PATCH(req: NextRequest, { params }: { params: { id: string } }) {
  const auth = await verifyFirebaseAuth(req)
  if (!auth || !ADMIN_EMAILS.includes(auth.email)) return unauthorized()

  let body: { action: AdminAction['type']; payload?: any }
  try {
    body = await req.json()
  } catch {
    return NextResponse.json({ error: 'Invalid JSON body' }, { status: 400 })
  }

  const actorId = auth.uid
  const action: AdminAction = { type: body.action as any, payload: { ...(body.payload || {}), actorId } } as AdminAction

  try {
    const result = await applyAdminAction(params.id, action)
    return NextResponse.json(result)
  } catch (e: any) {
    return NextResponse.json({ error: e.message || 'Failed to update order' }, { status: 400 })
  }
}
