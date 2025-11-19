import { NextRequest, NextResponse } from 'next/server'
import { auth } from '@/lib/auth'
import { ADMIN_EMAILS } from '@/lib/constants'
import { getOrderById, applyAdminAction, type AdminAction } from '@/lib/orders'

function unauthorized() {
  return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })
}

export async function GET(_req: NextRequest, { params }: { params: { id: string } }) {
  const session = await auth()
  if (!session?.user?.email || !ADMIN_EMAILS.includes(session.user.email)) return unauthorized()

  try {
    const order = await getOrderById(params.id)
    if (!order) return NextResponse.json({ error: 'Not found' }, { status: 404 })
    return NextResponse.json({ order })
  } catch (e: any) {
    return NextResponse.json({ error: e.message || 'Failed to fetch order' }, { status: 500 })
  }
}

export async function PATCH(req: NextRequest, { params }: { params: { id: string } }) {
  const session = await auth()
  if (!session?.user?.email || !ADMIN_EMAILS.includes(session.user.email)) return unauthorized()

  let body: { action: AdminAction['type']; payload?: any }
  try {
    body = await req.json()
  } catch {
    return NextResponse.json({ error: 'Invalid JSON body' }, { status: 400 })
  }

  const actorId = session.user.id
  const action: AdminAction = { type: body.action as any, payload: { ...(body.payload || {}), actorId } } as AdminAction

  try {
    const result = await applyAdminAction(params.id, action)
    return NextResponse.json(result)
  } catch (e: any) {
    return NextResponse.json({ error: e.message || 'Failed to update order' }, { status: 400 })
  }
}
