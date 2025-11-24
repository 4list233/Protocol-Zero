import { NextRequest, NextResponse } from 'next/server'
import { ADMIN_EMAILS } from '@/lib/constants'
import { fetchProductsFromNotion } from '@/lib/notion-products'

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

export async function GET(req: NextRequest) {
  const auth = await verifyFirebaseAuth(req)
  if (!auth || !ADMIN_EMAILS.includes(auth.email)) {
    return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })
  }

  try {
    const products = await fetchProductsFromNotion()
    return NextResponse.json({ products })
  } catch (e: any) {
    return NextResponse.json({ error: e.message || 'Failed to fetch products' }, { status: 500 })
  }
}

