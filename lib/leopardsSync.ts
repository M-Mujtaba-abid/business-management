// Our own check of Leopards, as a backup to the Leopards push webhook:
// asks Leopards' tracking API about every order still Packing / Dispatched with a Leopards
// tracking number, and applies the latest status (same rules as the push, lib/courierUpdate.ts).
// Runs once a day (Vercel cron → /api/cron/leopards-sync) and from the "Check Leopards" button.
import prisma from '@/lib/prisma'
import { isLeopardsCN, leopardsEnabled, normalizeCN, parseLeopardsDate, trackPacket } from '@/lib/leopards'
import { applyCourierStatus } from '@/lib/courierUpdate'
import { syncLeopardsMoney } from '@/lib/leopardsMoney'

const LOOKBACK_DAYS = 60 // older undelivered orders are left alone
const PARALLEL = 4

export interface SyncSummary {
  configured: boolean
  checked: number // tracking numbers asked
  delivered: number[] // order numbers moved to Delivered
  dispatched: number[] // order numbers moved to Dispatched
  updated: number // got a newer courier status (badge) without a status change
  failed: string[] // tracking numbers Leopards could not answer for
  moneyChecked: number // delivered parcels whose Leopards money was refreshed
  paid: number[] // order numbers marked Received because Leopards paid them
  alerted?: number // orders in the owners' WhatsApp payment alert
  moneyError?: string
}

export async function syncLeopardsOrders(): Promise<SyncSummary> {
  const summary: SyncSummary = {
    configured: leopardsEnabled(),
    checked: 0,
    delivered: [],
    dispatched: [],
    updated: 0,
    failed: [],
    moneyChecked: 0,
    paid: [],
  }
  if (!summary.configured) return summary

  const since = new Date(Date.now() - LOOKBACK_DAYS * 24 * 60 * 60 * 1000)
  const rows = await prisma.sale.findMany({
    where: { status: { in: ['PACKING', 'DISPATCHED'] }, trackingNumber: { not: null }, createdAt: { gte: since } },
    select: { trackingNumber: true, orderNo: true },
  })

  const orderNoByCn = new Map<string, number | null>()
  for (const r of rows) {
    const cn = normalizeCN(r.trackingNumber)
    if (isLeopardsCN(cn)) orderNoByCn.set(cn, r.orderNo)
  }
  const cns = Array.from(orderNoByCn.keys())

  const checkOne = async (cn: string) => {
    summary.checked++
    const res = await trackPacket(cn, { fresh: true })
    if (!res.ok) {
      summary.failed.push(cn)
      return
    }
    const latest = res.tracking.events[0] // newest first
    const at = (latest && parseLeopardsDate(`${latest.date} ${latest.time}`.trim())) || new Date()
    const result = await applyCourierStatus({ cn, status: res.tracking.status, at, via: 'check' })
    const orderNo = orderNoByCn.get(cn)
    if (result === 'delivered' && orderNo != null) summary.delivered.push(orderNo)
    else if (result === 'dispatched' && orderNo != null) summary.dispatched.push(orderNo)
    else if (result === 'saved') summary.updated++
  }

  for (let i = 0; i < cns.length; i += PARALLEL) {
    await Promise.all(
      cns.slice(i, i + PARALLEL).map((cn) =>
        checkOne(cn).catch((err) => {
          console.error('Leopards sync failed for', cn, err)
          summary.failed.push(cn)
        })
      )
    )
  }

  // Then the money of delivered parcels (includes the ones that just turned Delivered)
  try {
    const money = await syncLeopardsMoney()
    summary.moneyChecked = money.checked
    summary.paid = money.paid
    summary.alerted = money.alerted || 0
  } catch (err: any) {
    console.error('Leopards money sync failed:', err)
    summary.moneyError = err?.message || 'failed'
  }

  console.log(
    `Leopards sync: ${summary.checked} checked, ${summary.delivered.length} delivered, ` +
      `${summary.dispatched.length} dispatched, ${summary.updated} updated, ${summary.failed.length} failed`
  )
  return summary
}
