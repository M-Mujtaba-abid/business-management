// Each person's money statement ("In hand" ledger): every amount added to or taken from the
// business money they hold, with its date. In hand = the sum of these entries — the same list feeds
// the Payments cards, the statement window and the no-negative-balance rule (lib/balanceGuard.ts),
// so the numbers can never disagree.
//
//  + order money received   payout − cover cost (cover cost is kept aside for the supplier);
//                           orders sold from our inventory: full payout (the stock was paid when bought)
//  − expense paid           Expense.paidById
//  − withdrawal             Withdrawal.personId
//  − delivery charge (DC)   Sale.dcPaidById, by order date, cancelled orders left out
//  − stock bought           StockPayment kind BUSINESS (from in hand; savings are not in-hand money)
//  + opening balance        MoneyEntry OPENING (money already in the account when the app started)
//  + investment             MoneyEntry INVESTMENT (own money put in; also the person's capital)
//  ± adjustment             MoneyEntry ADJUSTMENT (a correction with a reason)
//  − capital taken back     Withdrawal type CAPITAL (shown apart from profit withdrawals)
import type { Prisma } from '@prisma/client'
import { payoutAmount } from '@/lib/saleMoney'

type Db = Prisma.TransactionClient

export type LedgerKind = 'order' | 'expense' | 'withdrawal' | 'dc' | 'stock' | 'opening' | 'investment' | 'adjustment'

export interface LedgerEntry {
  id: string // stable key (e.g. "order:#1194", "exp:<id>")
  personId: string
  date: Date
  kind: LedgerKind
  amount: number // + in, − out
  title: string
  detail: string
  orderNo?: number | null
  refId?: string // MoneyEntry / Withdrawal id (so the statement can offer Delete)
}

// Order money that counts for the person who received it (see header)
export const orderNet = (s: {
  soldPrice: number
  costPrice: number
  quantity: number
  receivedAmount: number | null
  inventoryItemId?: string | null
}) => payoutAmount(s) - (s.inventoryItemId ? 0 : s.costPrice * s.quantity)

const rs = (n: number) => `Rs. ${Math.round(n).toLocaleString('en-PK')}`
const r2 = (n: number) => Math.round(n * 100) / 100

// All entries, grouped by person (only people that exist). personId limits it to one person.
export async function buildLedger(db: Db, personId?: string): Promise<Map<string, LedgerEntry[]>> {
  const only = (field: string) => (personId ? { [field]: personId } : { [field]: { not: null } })
  const [people, received, expenses, withdrawals, dcPaid, stockPaid, moneyEntries] = await Promise.all([
    db.person.findMany({ where: personId ? { id: personId } : {}, select: { id: true } }),
    db.sale.findMany({
      where: { paymentStatus: 'RECEIVED', ...only('receivedById') },
      select: {
        id: true,
        orderNo: true,
        parcelId: true,
        receivedById: true,
        customerName: true,
        productName: true,
        soldPrice: true,
        costPrice: true,
        quantity: true,
        receivedAmount: true,
        inventoryItemId: true,
        paymentReceivedAt: true,
        createdAt: true,
        paymentSource: { select: { name: true } },
      },
    }),
    db.expense.findMany({ where: only('paidById'), select: { id: true, paidById: true, amount: true, title: true, note: true, createdAt: true } }),
    db.withdrawal.findMany({ where: personId ? { personId } : {}, select: { id: true, personId: true, amount: true, reason: true, type: true, createdAt: true } }),
    db.sale.findMany({
      where: { status: { not: 'CANCELLED' }, deliveryCharge: { gt: 0 }, ...only('dcPaidById') },
      select: { id: true, orderNo: true, parcelId: true, dcPaidById: true, deliveryCharge: true, customerName: true, city: true, createdAt: true },
    }),
    db.stockPayment.findMany({
      where: { kind: 'BUSINESS', ...(personId ? { personId } : {}) },
      select: {
        id: true,
        personId: true,
        amount: true,
        createdAt: true,
        purchase: { select: { quantity: true, unitCost: true, totalCost: true, item: { select: { name: true } } } },
      },
    }),
    db.moneyEntry.findMany({ where: personId ? { personId } : {}, select: { id: true, personId: true, kind: true, amount: true, date: true, note: true, createdBy: true } }),
  ])

  const map = new Map<string, LedgerEntry[]>(people.map((p) => [p.id, []]))
  const push = (e: LedgerEntry) => map.get(e.personId)?.push(e)

  // + Orders received: one entry per order (a parcel's products together) per person
  const orders = new Map<string, typeof received>()
  for (const s of received) {
    const key = `${s.receivedById}|${s.orderNo != null ? `#${s.orderNo}` : s.parcelId || s.id}`
    orders.set(key, [...(orders.get(key) || []), s])
  }
  for (const [key, rows] of Array.from(orders.entries())) {
    const lead = rows[0]
    const payout = r2(rows.reduce((a, s) => a + payoutAmount(s), 0))
    const cover = r2(rows.filter((s) => !s.inventoryItemId).reduce((a, s) => a + s.costPrice * s.quantity, 0))
    const fromStock = rows.some((s) => s.inventoryItemId)
    const amount = r2(rows.reduce((a, s) => a + orderNet(s), 0))
    const date = rows.reduce<Date | null>((m, s) => (s.paymentReceivedAt && (!m || s.paymentReceivedAt > m) ? s.paymentReceivedAt : m), null) || lead.createdAt
    push({
      id: `order:${key}`,
      personId: lead.receivedById as string,
      date,
      kind: 'order',
      amount,
      title: `Order ${lead.orderNo != null ? `#${lead.orderNo}` : ''} received`.replace('  ', ' '),
      detail:
        `${lead.customerName}${lead.paymentSource?.name ? ` · from ${lead.paymentSource.name}` : ''} · payout ${rs(payout)}` +
        (cover > 0 ? ` − cover cost ${rs(cover)} (kept for supplier)` : '') +
        (fromStock ? ' · from inventory (stock already paid)' : ''),
      orderNo: lead.orderNo,
    })
  }

  // − Expenses
  for (const e of expenses) {
    push({
      id: `exp:${e.id}`,
      personId: e.paidById as string,
      date: e.createdAt,
      kind: 'expense',
      amount: -e.amount,
      title: `Expense: ${e.title}`,
      detail: e.note || '',
    })
  }

  // − Withdrawals
  for (const w of withdrawals) {
    push({
      id: `wd:${w.id}`,
      personId: w.personId,
      date: w.createdAt,
      kind: 'withdrawal',
      amount: -w.amount,
      title: w.type === 'CAPITAL' ? 'Capital taken back' : 'Withdrawal (profit)',
      detail: w.reason || '',
      refId: w.id,
    })
  }

  // ± Opening balance / investment / adjustment
  const KIND_WORD = { OPENING: 'Opening balance', INVESTMENT: 'Investment (own money in)', ADJUSTMENT: 'Adjustment' } as const
  for (const m of moneyEntries) {
    push({
      id: `me:${m.id}`,
      personId: m.personId,
      date: m.date,
      kind: m.kind.toLowerCase() as LedgerKind,
      amount: m.amount,
      title: KIND_WORD[m.kind],
      detail: [m.note, m.createdBy ? `by ${m.createdBy}` : ''].filter(Boolean).join(' · '),
      refId: m.id,
    })
  }

  // − Delivery charges: one entry per order per person
  const dcs = new Map<string, typeof dcPaid>()
  for (const s of dcPaid) {
    const key = `${s.dcPaidById}|${s.orderNo != null ? `#${s.orderNo}` : s.parcelId || s.id}`
    dcs.set(key, [...(dcs.get(key) || []), s])
  }
  for (const [key, rows] of Array.from(dcs.entries())) {
    const lead = rows[0]
    push({
      id: `dc:${key}`,
      personId: lead.dcPaidById as string,
      date: lead.createdAt,
      kind: 'dc',
      amount: -r2(rows.reduce((a, s) => a + s.deliveryCharge, 0)),
      title: `Delivery charge${lead.orderNo != null ? ` · order #${lead.orderNo}` : ''}`,
      detail: `${lead.customerName}${lead.city && lead.city !== 'General' ? `, ${lead.city}` : ''}`,
      orderNo: lead.orderNo,
    })
  }

  // − Stock bought from in hand
  for (const p of stockPaid) {
    const pu = p.purchase
    push({
      id: `stock:${p.id}`,
      personId: p.personId,
      date: p.createdAt,
      kind: 'stock',
      amount: -p.amount,
      title: `Stock bought: ${pu.item.name}`,
      detail: `${pu.quantity} × ${rs(pu.unitCost)} = ${rs(pu.totalCost)}${Math.abs(pu.totalCost - p.amount) >= 0.5 ? ` (your share ${rs(p.amount)})` : ''}`,
    })
  }

  // Oldest first (ties: money in before money out on the same moment)
  for (const list of Array.from(map.values())) {
    list.sort((a, b) => a.date.getTime() - b.date.getTime() || b.amount - a.amount || a.id.localeCompare(b.id))
  }
  return map
}

export const sumLedger = (entries: LedgerEntry[]) => r2(entries.reduce((a, e) => a + e.amount, 0))
