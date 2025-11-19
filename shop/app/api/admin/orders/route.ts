import { NextRequest, NextResponse } from 'next/server'
import { auth } from '@/lib/auth'
import { ADMIN_EMAILS } from '@/lib/constants'
import { getOrders, type OrderStatus } from '@/lib/orders'

export async function GET(req: NextRequest) {
  const session = await auth()
  if (!session?.user?.email || !ADMIN_EMAILS.includes(session.user.email)) {
    return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })
  }

  const { searchParams } = new URL(req.url)
  const status = (searchParams.get('status') || undefined) as OrderStatus | undefined
  const pageSize = searchParams.get('pageSize') ? Number(searchParams.get('pageSize')) : 25

  try {
    const orders = await getOrders({ status, pageSize })
    return NextResponse.json({ orders })
  } catch (e: any) {
    return NextResponse.json({ error: e.message || 'Failed to fetch orders' }, { status: 500 })
  }
}
