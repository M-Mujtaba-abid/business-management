// Daily owner report on WhatsApp: a morning to-do list and a night summary (Pakistan time).
// Settings (AppSetting): report.recipients = JSON [{ name, phone }], report.morning / report.night = 'true' | 'false'.
import prisma from '@/lib/prisma'
import { buildLedger, sumLedger } from '@/lib/personLedger'
import { computeAttention } from '@/lib/attention'
import { sendOwnerMessage } from '@/lib/whatsapp'

export type ReportSlot = 'morning' | 'night'
export interface Recipient {
  name: string
  phone: string
}

const BUSINESS = process.env.BUSINESS_NAME || 'Fancy Store'
const PKT = 5 * 60 * 60 * 1000 // Pakistan is UTC+5 all year
const DAY = 24 * 60 * 60 * 1000
const rs = (n: number) => `Rs ${Math.round(n).toLocaleString('en-PK')}`

// Start of a Pakistan day (offset 0 = today, -1 = yesterday) as a UTC Date
function pkDayStart(offset = 0): Date {
  const pk = new Date(Date.now() + PKT)
  return new Date(Date.UTC(pk.getUTCFullYear(), pk.getUTCMonth(), pk.getUTCDate() + offset) - PKT)
}
const pkLabel = (d: Date) => new Date(d.getTime() + PKT).toLocaleDateString('en-GB', { weekday: 'short', day: 'numeric', month: 'short', timeZone: 'UTC' })

// ── Settings ──
export async function getReportSettings() {
  const rows = await prisma.appSetting.findMany({ where: { key: { in: ['report.recipients', 'report.morning', 'report.night'] } } })
  const get = (k: string) => rows.find((r) => r.key === k)?.value
  let recipients: Recipient[] = []
  try {
    recipients = JSON.parse(get('report.recipients') || '[]')
  } catch {}
  return {
    recipients: Array.isArray(recipients) ? recipients.filter((r) => r && r.phone) : [],
    morning: get('report.morning') !== 'false',
    night: get('report.night') !== 'false',
  }
}

export async function saveReportSettings(s: { recipients?: Recipient[]; morning?: boolean; night?: boolean }) {
  const set = (key: string, value: string) => prisma.appSetting.upsert({ where: { key }, create: { key, value }, update: { value } })
  if (s.recipients) {
    const clean = s.recipients
      .map((r) => ({ name: String(r.name || '').trim().slice(0, 40), phone: String(r.phone || '').replace(/[^\d+]/g, '') }))
      .filter((r) => r.phone)
    await set('report.recipients', JSON.stringify(clean))
  }
  if (typeof s.morning === 'boolean') await set('report.morning', String(s.morning))
  if (typeof s.night === 'boolean') await set('report.night', String(s.night))
}

// ── Facts for one Pakistan day ──
async function dayFacts(from: Date, to: Date) {
  const [newOrders, statusLogs, ledger, people] = await Promise.all([
    prisma.sale.findMany({
      where: { createdAt: { gte: from, lt: to } },
      select: { orderNo: true, id: true, parcelId: true, soldPrice: true, quantity: true, status: true },
    }),
    prisma.orderLog.findMany({ where: { action: 'status', createdAt: { gte: from, lt: to } }, select: { orderNo: true, details: true } }),
    buildLedger(prisma),
    prisma.person.findMany({ select: { id: true, name: true } }),
  ])
  const orderKeys = new Set(newOrders.map((s) => (s.orderNo != null ? `#${s.orderNo}` : s.parcelId || s.id)))
  const value = newOrders.filter((s) => s.status !== 'CANCELLED').reduce((a, s) => a + s.soldPrice * s.quantity, 0)

  // Deliveries / returns / cancels today come from the order history (status changes)
  const movedTo = (to: string) => Array.from(new Set(statusLogs.filter((l) => (l.details as any)?.to === to && l.orderNo != null).map((l) => l.orderNo as number)))
  const delivered = movedTo('DELIVERED')
  const returned = movedTo('RETURNED')
  const cancelled = movedTo('CANCELLED')
  const deliveredRows = delivered.length
    ? await prisma.sale.findMany({ where: { orderNo: { in: delivered }, status: 'DELIVERED' }, select: { soldPrice: true, quantity: true, profit: true } })
    : []

  const money = people.map((p) => {
    const all = ledger.get(p.id) || []
    const today = all.filter((e) => e.date >= from && e.date < to)
    return {
      name: p.name,
      received: today.filter((e) => e.kind === 'order').reduce((a, e) => a + e.amount, 0),
      receivedCount: today.filter((e) => e.kind === 'order').length,
      out: today.filter((e) => e.amount < 0).reduce((a, e) => a + e.amount, 0),
      inHand: sumLedger(all),
    }
  })

  return {
    newOrders: orderKeys.size,
    newValue: value,
    delivered: delivered.length,
    deliveredSales: deliveredRows.reduce((a, s) => a + s.soldPrice * s.quantity, 0),
    deliveredProfit: deliveredRows.reduce((a, s) => a + s.profit, 0),
    returned: returned.length,
    cancelled: cancelled.length,
    money,
  }
}

async function bankLines() {
  const [people, last] = await Promise.all([
    prisma.person.findMany({ select: { id: true, name: true } }),
    prisma.bankCheck.findMany({ orderBy: { createdAt: 'desc' }, distinct: ['personId'] }),
  ])
  const of = new Map(last.map((c) => [c.personId, c]))
  return people.map((p) => {
    const c = of.get(p.id)
    if (!c) return `${p.name}: not checked yet`
    const when = pkLabel(c.createdAt)
    return Math.abs(c.difference) < 1
      ? `${p.name}: ✅ matched (${when})`
      : `${p.name}: ⚠️ bank has ${rs(Math.abs(c.difference))} ${c.difference > 0 ? 'MORE' : 'LESS'} than the app (${when})`
  })
}

// ── The messages ──
export async function buildReport(slot: ReportSlot): Promise<string> {
  const attention = await computeAttention()
  const todo = attention.map((a) => `${a.severity === 'high' ? '🔴' : a.severity === 'medium' ? '🟠' : '🔵'} ${a.title}: *${a.count}*${a.amount ? ` (${rs(a.amount)})` : ''}`)

  if (slot === 'night') {
    const from = pkDayStart(0)
    const f = await dayFacts(from, new Date(from.getTime() + DAY))
    const lines = [
      `🌙 *${BUSINESS} · Daily report*`,
      `_${pkLabel(from)}_`,
      '',
      `📦 New orders: *${f.newOrders}* (${rs(f.newValue)})`,
      `🚚 Delivered: *${f.delivered}*${f.delivered ? ` (${rs(f.deliveredSales)})` : ''} · Returned: *${f.returned}* · Cancelled: *${f.cancelled}*`,
      `📈 Profit on today's deliveries: *${rs(f.deliveredProfit)}*`,
      '',
      '💵 *Money today*',
      ...f.money.map((m) => `• ${m.name}: +${rs(m.received)} received (${m.receivedCount})${m.out ? ` · −${rs(-m.out)} out` : ''}`),
      '',
      '👛 *In hand now*',
      ...f.money.map((m) => `• ${m.name}: *${rs(m.inHand)}*`),
      '',
      '🏦 *Bank check*',
      ...(await bankLines()).map((l) => `• ${l}`),
      '',
      todo.length ? '⚠️ *Needs attention*' : '✅ Nothing stuck right now',
      ...todo,
    ]
    return lines.join('\n')
  }

  // morning
  const today = pkDayStart(0)
  const y = await dayFacts(pkDayStart(-1), today)
  const lines = [
    `☀️ *Good morning · ${BUSINESS}*`,
    `_To-do for ${pkLabel(today)}_`,
    '',
    todo.length ? '📝 *Needs attention today*' : '✅ Nothing stuck — all clear',
    ...todo,
    '',
    `📊 *Yesterday*: ${y.newOrders} new orders (${rs(y.newValue)}) · ${y.delivered} delivered · ${y.returned} returned · profit ${rs(y.deliveredProfit)}`,
    '',
    '👛 *In hand now*',
    ...y.money.map((m) => `• ${m.name}: *${rs(m.inHand)}*`),
    '',
    'Open the app → Dashboard → Needs attention for the orders.',
  ]
  return lines.join('\n')
}

// Sends the report to every recipient. force=true ignores the on/off switch (test button).
export async function sendDailyReport(slot: ReportSlot, opts: { force?: boolean } = {}) {
  const settings = await getReportSettings()
  if (!opts.force && !settings[slot]) return { sent: 0, skipped: `The ${slot} report is switched off.`, errors: [] as string[] }
  if (!settings.recipients.length) return { sent: 0, skipped: 'No phone numbers in Settings → Daily WhatsApp report.', errors: [] as string[] }
  const text = await buildReport(slot)
  const errors: string[] = []
  let sent = 0
  for (const r of settings.recipients) {
    const err = await sendOwnerMessage(r.phone, text)
    if (err) errors.push(`${r.name || r.phone}: ${err}`)
    else sent++
  }
  console.log(`Daily ${slot} report: sent to ${sent}, ${errors.length} error(s)`)
  return { sent, skipped: null as string | null, errors }
}
