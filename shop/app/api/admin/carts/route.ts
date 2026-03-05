import { NextRequest, NextResponse } from 'next/server'
import { requireAdmin } from '@/lib/require-admin'
import { getAllCarts, type CartStatus } from '@/lib/knack-carts'

export const dynamic = 'force-dynamic'

export async function GET(request: NextRequest) {
  const adminError = await requireAdmin(request)
  if (adminError) return adminError

  try {
    const { searchParams } = new URL(request.url)
    const statusParam = searchParams.get('status')

    const validStatuses: CartStatus[] = ['Active', 'Abandoned', 'Converted', 'Expired']
    const statusFilter =
      statusParam && validStatuses.includes(statusParam as CartStatus)
        ? (statusParam as CartStatus)
        : undefined

    const carts = await getAllCarts(statusFilter)

    const response = carts.map(cart => ({
      id: cart.id,
      anonymousId: cart.anonymousId,
      email: cart.email,
      itemCount: cart.itemCount,
      totalCad: cart.totalCad,
      status: cart.status,
      lastActivityAt: cart.lastActivityAt?.toISOString() || null,
      createdAt: cart.createdAt.toISOString(),
      items: cart.items.map(item => ({
        productTitle: item.productTitle,
        variantTitle: item.variantTitle,
        quantity: item.quantity,
        regularPrice: item.regularPrice,
      })),
    }))

    return NextResponse.json({ carts: response })
  } catch (error) {
    console.error('[Admin Carts API] Error:', error)
    return NextResponse.json({ error: 'Failed to load carts' }, { status: 500 })
  }
}
