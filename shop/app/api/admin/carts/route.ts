import { NextRequest, NextResponse } from 'next/server'
import { requireAdmin } from '@/lib/require-admin'
import { getAllCarts, type CartStatus } from '@/lib/knack-carts'
import { getKnackRecords } from '@/lib/knack-client'
import { KNACK_CONFIG, getFieldValue } from '@/lib/knack-config'

export const dynamic = 'force-dynamic'

const USER_FIELDS = KNACK_CONFIG.fields.users
const CART_FIELDS = KNACK_CONFIG.fields.carts

export async function GET(request: NextRequest) {
  const authCheck = await requireAdmin(request)
  if (authCheck instanceof NextResponse) return authCheck

  try {
    const { searchParams } = new URL(request.url)
    const statusParam = searchParams.get('status')

    const validStatuses: CartStatus[] = ['Active', 'Abandoned', 'Converted', 'Expired']
    const statusFilter =
      statusParam && validStatuses.includes(statusParam as CartStatus)
        ? (statusParam as CartStatus)
        : undefined

    const carts = await getAllCarts(statusFilter)

    // Fetch all users to resolve linked user info
    const userMap = new Map<string, { displayName: string; name: string; email: string; phone: string }>()
    try {
      const userRecords = await getKnackRecords<Record<string, unknown>>(
        KNACK_CONFIG.objectKeys.users,
        { perPage: 1000 }
      )
      for (const u of userRecords) {
        const nameRaw = getFieldValue(u, USER_FIELDS.name, 'Name')
        let name = ''
        if (typeof nameRaw === 'object' && nameRaw !== null) {
          const n = nameRaw as Record<string, unknown>
          name = [n.first, n.last].filter(Boolean).join(' ')
        } else {
          name = String(nameRaw || '')
        }
        userMap.set(String(u.id), {
          displayName: String(getFieldValue(u, USER_FIELDS.displayName, 'Display Name') || ''),
          name,
          email: String(getFieldValue(u, USER_FIELDS.email, 'Email') || ''),
          phone: String(getFieldValue(u, USER_FIELDS.phone, 'Phone') || ''),
        })
      }
    } catch {
      // Continue without user data
    }

    const response = carts.map(cart => {
      // Resolve linked user from the cart's raw record (userId connection)
      let linkedUser: { displayName: string; name: string; email: string; phone: string } | null = null
      if (cart.userId) {
        linkedUser = userMap.get(cart.userId) || null
      }

      return {
        id: cart.id,
        anonymousId: cart.anonymousId,
        email: cart.email,
        linkedUser,
        itemCount: cart.itemCount,
        totalCad: cart.totalCad,
        status: cart.status,
        lastActivityAt: cart.lastActivityAt?.toISOString() || null,
        createdAt: cart.createdAt.toISOString(),
        items: cart.items.map(item => ({
          productId: item.productId,
          productTitle: item.productTitle,
          productImage: item.productImage,
          category: item.category || null,
          variantId: item.variantId,
          variantTitle: item.variantTitle,
          sku: item.sku || null,
          selectedOption: item.selectedOption || null,
          regularPrice: item.regularPrice,
          addonPrice: item.addonPrice || null,
          isAddonEligible: item.isAddonEligible || false,
          quantity: item.quantity,
          itemType: item.itemType || 'regular',
        })),
      }
    })

    return NextResponse.json({ carts: response })
  } catch (error) {
    console.error('[Admin Carts API] Error:', error)
    return NextResponse.json({ error: 'Failed to load carts' }, { status: 500 })
  }
}
