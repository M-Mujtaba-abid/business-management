// Daily owner report on WhatsApp: a morning to-do list and a night summary (Pakistan time).
// Settings (AppSetting): report.recipients = JSON [{ name, phone }], report.morning / report.night = 'true' | 'false'.
import prisma from '@/lib/prisma'
import { buildLedger, sumLedger } from '@/lib/personLedger'
import { computeAttention } from '@/lib/attention'
import { sendOwnerMessage } from '@/lib/whatsapp'
import { appLink } from '@/lib/leopards'

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

// ── The messages ──
// Short on purpose (owner's choice): new orders, delivered, profit, In hand.
// The morning one also lists every order still Packing / Dispatched by order number.
const dayLines = (f: Awaited<ReturnType<typeof dayFacts>>) => [
  `📦 New orders: *${f.newOrders}* · ${rs(f.newValue)}`,
  `🚚 Delivered: *${f.delivered}*${f.delivered ? ` · ${rs(f.deliveredSales)}` : ''}`,
  `📈 Profit: *${rs(f.deliveredProfit)}*`,
  '',
  '👛 *In hand*',
  ...f.money.map((m) => `${m.name}: *${rs(m.inHand)}*`),
]

// Order numbers of all orders in a status, oldest first: "#1200, #1206"
async function orderNumbers(status: 'PACKING' | 'DISPATCHED') {
  const rows = await prisma.sale.findMany({
    where: { status },
    orderBy: { createdAt: 'asc' },
    select: { orderNo: true, id: true, parcelId: true },
  })
  const nos = Array.from(new Set(rows.map((r) => r.orderNo).filter((n): n is number => n != null)))
  const without = new Set(rows.filter((r) => r.orderNo == null).map((r) => r.parcelId || r.id)).size
  return { count: nos.length + without, list: nos.map((n) => `#${n}`).join(', ') + (without ? `${nos.length ? ', ' : ''}+${without} without number` : '') }
}

export async function buildReport(slot: ReportSlot): Promise<string> {
  if (slot === 'night') {
    const from = pkDayStart(0)
    const f = await dayFacts(from, new Date(from.getTime() + DAY))
    return withLink([`🌙 *${BUSINESS}* · ${pkLabel(from)}`, '', ...dayLines(f)].join('\n'), 'dashboard')
  }

  // morning: yesterday in short + what is still packing / on the way + one attention line
  const today = pkDayStart(0)
  const yesterday = pkDayStart(-1)
  const [y, packing, dispatched, attention] = await Promise.all([
    dayFacts(yesterday, today),
    orderNumbers('PACKING'),
    orderNumbers('DISPATCHED'),
    computeAttention(),
  ])
  const urgent = attention.filter((a) => a.severity !== 'info').length
  return withLink([
    `☀️ *${BUSINESS}* · Yesterday (${pkLabel(yesterday)})`,
    '',
    ...dayLines(y),
    '',
    `📦 *Packing (${packing.count})*`,
    packing.count ? packing.list : 'none',
    '',
    `🚚 *Dispatched (${dispatched.count})*`,
    dispatched.count ? dispatched.list : 'none',
    ...(urgent ? ['', `⚠️ ${urgent} thing${urgent > 1 ? 's' : ''} need attention → open the app`] : []),
  ].join('\n'), 'dashboard')
}

// Every owner message ends with a link to the app (the page that fits the message)
export const withLink = (text: string, tab?: string) => {
  const url = appLink(tab)
  return url ? `${text}\n\n🔗 ${url}` : text
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
