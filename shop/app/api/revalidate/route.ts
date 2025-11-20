import { NextResponse } from 'next/server'
import { clearCache } from '@/lib/notion-cache'

export async function POST(request: Request) {
  try {
    const authHeader = request.headers.get('authorization')
    const token = process.env.REVALIDATE_TOKEN || 'dev-token'

    if (authHeader !== `Bearer ${token}`) {
      return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })
    }

    clearCache()

    return NextResponse.json({ revalidated: true, timestamp: Date.now() })
  } catch (error) {
    return NextResponse.json({ error: 'Error revalidating' }, { status: 500 })
  }
}
