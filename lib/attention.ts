// "Needs attention": everything that is stuck or waiting, in one list. Used by the Dashboard box,
// the morning to-do report and the night report. Each order check also has a Prisma `where`, so the
// Orders page can show exactly those orders (?attention=<key>).
import type { Prisma } from '@prisma/client'
import prisma from '@/lib/prisma'
import { buildLedger, sumLedger } from '@/lib/personLedger'

const DAY = 24 * 60 * 60 * 1000
const ago = (days: number) => new Date(Date.now() - days * DAY)

export type Severity = 'high' | 'medium' | 'info'

// Order checks (rules in days)
export const ATTENTION_RULES = {
  packing_old: 2, // still Packing after 2 days
  unconfirmed: 1, // asked to confirm on WhatsApp, no answer after 24 hours
  stuck_dispatched: 4, // Dispatched, no courier update for 4 days
  delivered_unpaid: 15, // Delivered, money not received after 15 days
  leopards_invoiced: 5, // Leopards invoiced it, still not paid after 5 days
  return_not_back: 7, // Returned, parcel not back with us after 7 days
} as const

export type OrderCheckKey = keyof typeof ATTENTION_RULES | 'whatsapp_failed' | 'reviews'

// The orders of each check (same rule for the count and for the Orders page filter)
export function attentionWhere(key: string): Prisma.SaleWhereInput | null {
  switch (key) {
    case 'packing_old':
      return { status: 'PACKING', createdAt: { lt: ago(ATTENTION_RULES.packing_old) } }
    case 'unconfirmed':
      return { status: 'PACKING', customerResponse: 'PENDING', createdAt: { lt: ago(ATTENTION_RULES.unconfirmed) } }
    case 'stuck_dispatched':
      return {
        status: 'DISPATCHED',
        OR: [
          { courierStatusAt: { lt: ago(ATTENTION_RULES.stuck_dispatched) } },
          { courierStatusAt: null, updatedAt: { lt: ago(ATTENTION_RULES.stuck_dispatched) } },
        ],
      }
    case 'delivered_unpaid':
      return {
        status: 'DELIVERED',
        paymentStatus: 'NOT_RECEIVED',
        OR: [
          { courierStatusAt: { lt: ago(ATTENTION_RULES.delivered_unpaid) } },
          { courierStatusAt: null, updatedAt: { lt: ago(ATTENTION_RULES.delivered_unpaid) } },
        ],
      }
    case 'leopards_invoiced':
      return { status: 'DELIVERED', paymentStatus: 'NOT_RECEIVED', courierPayment: 'PENDING' }
    case 'return_not_back':
      return { status: 'RETURNED', returnReceived: false, returnedAt: { lt: ago(ATTENTION_RULES.return_not_back) } }
    case 'reviews':
      return { status: 'DELIVERED', reviewStatus: 'PENDING' }
    default:
      return null
  }
}

export interface AttentionOrder {
  orderNo: number | null
  saleId: string
  customer: string
  amount: number
  detail: string
}

export interface AttentionItem {
  key: string
  title: string
  hint: string // what to do
  severity: Severity
  count: number
  amount?: number
  orders?: AttentionOrder[] // up to 8, oldest first
  // where the button goes: Orders filtered by this check, or another page
  open: { section: 'orders'; attention: string } | { section: 'inventory' | 'partners-suppliers' | 'whatsapp' }
}

const rs = (n: number) => `Rs. ${Math.round(n).toLocaleString('en-PK')}`
const daysSince = (d: Date | null | undefined) => (d ? Math.max(0, Math.floor((Date.now() - d.getTime()) / DAY)) : null)

async function orderCheck(
  key: OrderCheckKey,
  title: string,
  hint: string,
  severity: Severity,
  detail: (s: any) => string,
  extraWhere: Prisma.SaleWhereInput = {}
): Promise<AttentionItem | null> {
  const where = attentionWhere(key)
  if (!where) return null
  const rows = await prisma.sale.findMany({
    where: { ...where, ...extraWhere },
    orderBy: { createdAt: 'asc' },
    select: {
      id: true,
      orderNo: true,
      parcelId: true,
      customerName: true,
      soldPrice: true,
      quantity: true,
      receivedAmount: true,
      createdAt: true,
      updatedAt: true,
      courierStatus: true,
      courierStatusAt: true,
      courierPayout: true,
      courierMoney: true,
      returnedAt: true,
      trackingNumber: true,
      customerPhone: true,
    },
  })
  // one line per order (a parcel's products together)
  const groups = new Map<string, typeof rows>()
  for (const r of rows) {
    const k = r.orderNo != null ? `#${r.orderNo}` : r.parcelId || r.id
    groups.set(k, [...(groups.get(k) || []), r])
  }
  if (groups.size === 0) return null
  const list = Array.from(groups.values())
  const amountOf = (g: typeof rows) => g.reduce((a, s) => a + (s.receivedAmount ?? s.soldPrice * s.quantity), 0)
  return {
    key,
    title,
    hint,
    severity,
    count: list.length,
    amount: Math.round(list.reduce((a, g) => a + amountOf(g), 0)),
    orders: list.slice(0, 8).map((g) => ({
      orderNo: g[0].orderNo,
      saleId: g[0].id,
      customer: g[0].customerName,
      amount: Math.round(amountOf(g)),
      detail: detail(g[0]),
    })),
    open: { section: 'orders', attention: key },
  }
}

export async function computeAttention(): Promise<AttentionItem[]> {
  const items: (AttentionItem | null)[] = await Promise.all([
    orderCheck('unconfirmed', 'Not confirmed on WhatsApp', 'Call the customer to confirm, or cancel the order', 'high', (s) => `asked ${daysSince(s.createdAt)}d ago`),
    orderCheck('packing_old', 'Still packing', 'Dispatch them, or cancel if not going', 'medium', (s) => `packing for ${daysSince(s.createdAt)}d`),
    orderCheck(
      'stuck_dispatched',
      'Parcels with no movement',
      'Check the tracking; call Leopards / the rider if it is stuck',
      'high',
      (s) => `${s.courierStatus ? `"${s.courierStatus}"` : 'no courier update'} · ${daysSince(s.courierStatusAt || s.updatedAt)}d`
    ),
    orderCheck(
      'leopards_invoiced',
      'Leopards invoiced, not paid yet',
      'Leopards made the invoice; the money should arrive soon. Chase Leopards if it is late',
      'medium',
      (s) => {
        const inv = (s.courierMoney as any) || {}
        return `${inv.invoiceNo || 'invoice'}${inv.invoiceDate ? ` · ${inv.invoiceDate}` : ''} · ${s.courierPayout != null ? rs(s.courierPayout) : ''}`
      }
    ),
    orderCheck(
      'delivered_unpaid',
      'Delivered, money not received',
      'Check the bank / Daraz / Leopards and mark Received, or chase the payment',
      'high',
      (s) => `delivered ${daysSince(s.courierStatusAt || s.updatedAt)}d ago`
    ),
    orderCheck('return_not_back', 'Returns not back yet', 'Ask the courier where the returned parcel is', 'medium', (s) => `returned ${daysSince(s.returnedAt)}d ago`),
    orderCheck('reviews', 'Customers to call for a review', 'Open the Reviews tab and call them', 'info', (s) => s.customerPhone || ''),
    whatsappFailed(),
    stockCheck(),
    ...(await bankChecks()),
  ])
  const order: Record<Severity, number> = { high: 0, medium: 1, info: 2 }
  return (items.filter(Boolean) as AttentionItem[]).sort((a, b) => order[a.severity] - order[b.severity])
}

async function whatsappFailed(): Promise<AttentionItem | null> {
  const failed = await prisma.whatsAppMessage.findMany({
    where: { status: 'FAILED', updatedAt: { gt: ago(7) }, kind: { in: ['ORDER_CONFIRM', 'DISPATCHED', 'DELIVERED', 'BILL'] } },
    orderBy: { updatedAt: 'desc' },
    take: 50,
    select: { orderNo: true, kind: true, error: true },
  })
  if (!failed.length) return null
  const nos = Array.from(new Set(failed.map((f) => f.orderNo)))
  const names = new Map(
    (await prisma.sale.findMany({ where: { orderNo: { in: nos } }, distinct: ['orderNo'], select: { orderNo: true, id: true, customerName: true } })).map((s) => [s.orderNo, s])
  )
  return {
    key: 'whatsapp_failed',
    title: 'WhatsApp messages not sent',
    hint: 'Open the order and press Resend, or message the customer yourself',
    severity: 'medium',
    count: nos.length,
    orders: failed.slice(0, 8).map((f) => ({
      orderNo: f.orderNo,
      saleId: names.get(f.orderNo)?.id || '',
      customer: names.get(f.orderNo)?.customerName || '',
      amount: 0,
      detail: `${f.kind.toLowerCase().replace('_', ' ')}: ${(f.error || '').slice(0, 60)}`,
    })),
    open: { section: 'whatsapp' },
  }
}

async function stockCheck(): Promise<AttentionItem | null> {
  const items = await prisma.inventoryItem.findMany({ where: { active: true }, select: { name: true, stockQty: true, lowStockAt: true } })
  const out = items.filter((i) => i.stockQty <= 0)
  const low = items.filter((i) => i.stockQty > 0 && i.lowStockAt != null && i.stockQty <= i.lowStockAt)
  if (!out.length && !low.length) return null
  return {
    key: 'stock',
    title: 'Inventory running out',
    hint: 'Buy stock on the Inventory page',
    severity: out.length ? 'high' : 'medium',
    count: out.length + low.length,
    orders: [...out, ...low].slice(0, 8).map((i) => ({
      orderNo: null,
      saleId: '',
      customer: i.name,
      amount: 0,
      detail: i.stockQty <= 0 ? 'out of stock' : `${i.stockQty} left`,
    })),
    open: { section: 'inventory' },
  }
}

// Bank check: never done, older than 7 days, or the last one did not match
async function bankChecks(): Promise<(AttentionItem | null)[]> {
  const [people, last, ledger] = await Promise.all([
    prisma.person.findMany({ select: { id: true, name: true } }),
    prisma.bankCheck.findMany({ orderBy: { createdAt: 'desc' }, distinct: ['personId'] }),
    buildLedger(prisma),
  ])
  const lastOf = new Map(last.map((c) => [c.personId, c]))
  const lines = people
    .map((p) => {
      const c = lastOf.get(p.id)
      const inHand = sumLedger(ledger.get(p.id) || [])
      if (!c) return { name: p.name, detail: `never checked · app says ${rs(inHand)}`, bad: false }
      if (Math.abs(c.difference) >= 1)
        return { name: p.name, detail: `last check: bank has ${rs(Math.abs(c.difference))} ${c.difference > 0 ? 'more' : 'less'} than the app`, bad: true }
      const d = daysSince(c.createdAt) ?? 0
      return d >= 7 ? { name: p.name, detail: `last checked ${d}d ago · app says ${rs(inHand)}`, bad: false } : null
    })
    .filter(Boolean) as { name: string; detail: string; bad: boolean }[]
  if (!lines.length) return [null]
  return [
    {
      key: 'bank_check',
      title: lines.some((l) => l.bad) ? 'Bank does not match the app' : 'Bank check due',
      hint: 'Payments → Check bank: type the balance from the bank app',
      severity: lines.some((l) => l.bad) ? 'high' : 'info',
      count: lines.length,
      orders: lines.map((l) => ({ orderNo: null, saleId: '', customer: l.name, amount: 0, detail: l.detail })),
      open: { section: 'partners-suppliers' },
    },
  ]
}
