import { NextRequest, NextResponse } from 'next/server'
import { cronAuthorized } from '@/lib/cronAuth'
import { syncLeopardsOrders } from '@/lib/leopardsSync'
import { sendDailyReport } from '@/lib/dailyReport'

export const dynamic = 'force-dynamic'
export const maxDuration = 60

// Vercel cron, twice a day (vercel.json):
//   ?slot=morning  09:00 Pakistan → check Leopards, then send the morning to-do report
//   ?slot=night    22:00 Pakistan → check Leopards, then send the night summary
export async function GET(req: NextRequest) {
  if (!cronAuthorized(req)) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })
  const slot = req.nextUrl.searchParams.get('slot') === 'morning' ? 'morning' : 'night'
  const out: Record<string, unknown> = { slot }
  try {
    out.leopards = await syncLeopardsOrders() // fresh courier status + money before the report
  } catch (err: any) {
    console.error('Cron Leopards check failed:', err)
    out.leopardsError = err?.message || 'failed'
  }
  try {
    out.report = await sendDailyReport(slot)
  } catch (err: any) {
    console.error('Cron report failed:', err)
    out.reportError = err?.message || 'failed'
  }
  return NextResponse.json(out)
}
