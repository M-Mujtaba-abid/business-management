import { NextRequest, NextResponse } from 'next/server'
import { cronAuthorized } from '@/lib/cronAuth'
import { syncLeopardsOrders } from '@/lib/leopardsSync'

export const dynamic = 'force-dynamic'
export const maxDuration = 60

// Leopards check on its own (the twice-daily cron /api/cron/daily also runs it before each report).
// Public in middleware (no login cookie on a cron call), so it checks CRON_SECRET itself.
export async function GET(req: NextRequest) {
  if (!cronAuthorized(req)) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })
  try {
    return NextResponse.json(await syncLeopardsOrders())
  } catch (error: any) {
    console.error('Leopards cron sync failed:', error)
    return NextResponse.json({ error: error.message || 'Leopards check failed' }, { status: 500 })
  }
}
