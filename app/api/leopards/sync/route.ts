import { NextResponse } from 'next/server'
import { syncLeopardsOrders } from '@/lib/leopardsSync'

export const dynamic = 'force-dynamic'
export const maxDuration = 60

// "Check Leopards" button on the Orders page (needs a login, like every private route)
export async function POST() {
  try {
    const summary = await syncLeopardsOrders()
    if (!summary.configured) {
      return NextResponse.json({ error: 'Leopards API key / password are not set on the server.' }, { status: 503 })
    }
    return NextResponse.json(summary)
  } catch (error: any) {
    return NextResponse.json({ error: error.message || 'Leopards check failed' }, { status: 500 })
  }
}
