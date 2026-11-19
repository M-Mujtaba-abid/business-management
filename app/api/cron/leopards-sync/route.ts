import crypto from 'crypto'
import { NextRequest, NextResponse } from 'next/server'
import { syncLeopardsOrders } from '@/lib/leopardsSync'

export const dynamic = 'force-dynamic'
export const maxDuration = 60

// Daily Vercel cron (vercel.json). Vercel sends "Authorization: Bearer <CRON_SECRET>".
// Public in middleware (no login cookie on a cron call), so it checks CRON_SECRET itself.
export async function GET(req: NextRequest) {
  const secret = process.env.CRON_SECRET || ''
  const given = (req.headers.get('authorization') || '').replace(/^bearer\s+/i, '')
  const ok =
    secret.length > 0 &&
    given.length === secret.length &&
    crypto.timingSafeEqual(Buffer.from(given), Buffer.from(secret))
  if (!ok) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })

  try {
    return NextResponse.json(await syncLeopardsOrders())
  } catch (error: any) {
    console.error('Leopards cron sync failed:', error)
    return NextResponse.json({ error: error.message || 'Leopards check failed' }, { status: 500 })
  }
}
