// Each person's money statement ("In hand" ledger): every amount added to or taken from the
// business money they hold, with its date. In hand = the sum of these entries — the same list feeds
// the Payments cards, the statement window and the no-negative-balance rule (lib/balanceGuard.ts),
// so the numbers can never disagree.
//
//  + order money received   the full payout (= what reached the bank). Its cover cost is supplier money
//                           still to pay (the entry's supplier part), until someone pays the supplier.
//                           Older orders whose supplier was paid without a payer recorded: payout − cover.
//                           Orders from our inventory / returned stock: no supplier to pay.
//  − supplier paid          Sale.supplierPaidById: the cover cost leaves the payer's In hand
//  ± money sent             MoneyTransfer: − from the sender, + to the receiver (with its supplier part)
//  − expense paid           Expense.paidById
//  − withdrawal             Withdrawal.personId
//  − delivery charge (DC)   Sale.dcPaidById, by order date, cancelled orders left out
//  − stock bought           StockPayment kind BUSINESS (from in hand; savings are not in-hand money)
//  + opening balance        MoneyEntry OPENING (money already in the account when the app started)
//  + investment             MoneyEntry INVESTMENT (own money put in; also the person's capital)
//  ± adjustment             MoneyEntry ADJUSTMENT (a correction with a reason)
//  − capital taken back     Withdrawal type CAPITAL (shown apart from profit withdrawals)
//  ± Leopards invoice       LeopardsInvoice received: invoice amount − money of the orders it paid
//                           (= charges Leopards took here for orders paid in another invoice, or
//                           returned ones), so In hand always equals what reached the bank
import type { Prisma } from '@prisma/client'
import { payoutAmount } from '@/lib/saleMoney'

type Db = Prisma.TransactionClient

export type LedgerKind =
  | 'order'
  | 'expense'
  | 'withdrawal'
  | 'dc'
  | 'stock'
  | 'opening'
  | 'investment'
  | 'adjustment'
  | 'courier'
  | 'supplier'
  | 'transfer'

export interface LedgerEntry {
  id: string // stable key (e.g. "order:#1194", "exp:<id>")
  personId: string
  date: Date
  kind: LedgerKind
  amount: number // + in, − out
  title: string
  detail: string
  orderNo?: number | null
  refId?: string // MoneyEntry / Withdrawal / MoneyTransfer id (so the statement can offer Delete)
  // change in the supplier money this person holds (cover cost still to pay to suppliers)
  supplier?: number
}

interface OrderMoneyRow {
  soldPrice: number
  costPrice: number
  quantity: number
  receivedAmount: number | null
  inventoryItemId?: string | null
  returnedItemId?: string | null
  supplierPaymentStatus?: string | null
  supplierPaidById?: string | null
}

// Cover cost owed to a supplier for this row (0 for our inventory / returned stock / old untracked orders)
export const coverOwed = (s: { costPrice: number; quantity: number; inventoryItemId?: string | null; supplierPaymentStatus?: string | null }) =>
  s.inventoryItemId || s.supplierPaymentStatus === 'NOT_APPLICABLE' ? 0 : s.costPrice * s.quantity

// Older orders whose supplier was marked paid before "who paid" was recorded: the cover cost was paid
// out of the order money, so it never reaches anyone's In hand (the old rule, kept for them)
const paidFromOrderMoney = (s: OrderMoneyRow) => s.supplierPaymentStatus === 'PAID' && !s.supplierPaidById

// What an order adds to the In hand of the person who received it, and how much of that is supplier money
export const orderMoney = (s: OrderMoneyRow) => {
  const cover = coverOwed(s)
  if (paidFromOrderMoney(s)) return { amount: payoutAmount(s) - cover, supplier: 0 }
  return { amount: payoutAmount(s), supplier: cover }
}

// Kept for callers that want the order's In hand effect only
export const orderNet = (s: OrderMoneyRow) => orderMoney(s).amount

const rs = (n: number) => `Rs. ${Math.round(n).toLocaleString('en-PK')}`
const r2 = (n: number) => Math.round(n * 100) / 100

// All entries, grouped by person (only people that exist). personId limits it to one person.
export async function buildLedger(db: Db, personId?: string): Promise<Map<string, LedgerEntry[]>> {
  const only = (field: string) => (personId ? { [field]: personId } : { [field]: { not: null } })
  const [people, received, expenses, withdrawals, dcPaid, stockPaid, moneyEntries, invoices, supplierPaid, transfers] = await Promise.all([
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
        returnedItemId: true,
        supplierPaymentStatus: true,
        supplierPaidById: true,
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
    db.leopardsInvoice.findMany({
      where: { receivedAt: { not: null }, ...only('receivedById') },
      select: { invoiceNo: true, amount: true, receivedAt: true, receivedById: true },
    }),
    // supplier paid by a person (who paid is recorded)
    db.sale.findMany({
      where: { supplierPaymentStatus: 'PAID', ...only('supplierPaidById') },
      select: {
        id: true,
        orderNo: true,
        parcelId: true,
        status: true,
        supplierPaidById: true,
        supplierPaidAt: true,
        createdAt: true,
        costPrice: true,
        quantity: true,
        inventoryItemId: true,
        supplierPaymentStatus: true,
        customerName: true,
        supplier: { select: { name: true } },
      },
    }),
    db.moneyTransfer.findMany({
      where: personId ? { OR: [{ fromId: personId }, { toId: personId }] } : {},
      select: { id: true, fromId: true, toId: true, amount: true, supplierPart: true, date: true, note: true, createdBy: true, from: { select: { name: true } }, to: { select: { name: true } } },
    }),
  ])

  // Orders each received invoice paid (whoever they went to)
  const paidByInvoice = new Map<string, { payout: number; orders: Set<string> }>()
  if (invoices.length) {
    const paidRows = await db.sale.findMany({
      where: { courierInvoiceNo: { in: invoices.map((i) => i.invoiceNo) }, paymentStatus: 'RECEIVED' },
      select: { courierInvoiceNo: true, orderNo: true, soldPrice: true, quantity: true, receivedAmount: true },
    })
    for (const s of paidRows) {
      const e = paidByInvoice.get(s.courierInvoiceNo as string) || { payout: 0, orders: new Set<string>() }
      e.payout += payoutAmount(s)
      if (s.orderNo != null) e.orders.add(`#${s.orderNo}`)
      paidByInvoice.set(s.courierInvoiceNo as string, e)
    }
  }

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
    const money = rows.map(orderMoney)
    const amount = r2(money.reduce((a, m) => a + m.amount, 0))
    const supplier = r2(money.reduce((a, m) => a + m.supplier, 0))
    const oldPaidCover = r2(rows.filter(paidFromOrderMoney).reduce((a, s) => a + coverOwed(s), 0))
    const fromStock = rows.some((s) => s.inventoryItemId)
    const date = rows.reduce<Date | null>((m, s) => (s.paymentReceivedAt && (!m || s.paymentReceivedAt > m) ? s.paymentReceivedAt : m), null) || lead.createdAt
    push({
      id: `order:${key}`,
      personId: lead.receivedById as string,
      date,
      kind: 'order',
      amount,
      supplier,
      title: `Order ${lead.orderNo != null ? `#${lead.orderNo}` : ''} received`.replace('  ', ' '),
      detail:
        `${lead.customerName}${lead.paymentSource?.name ? ` · from ${lead.paymentSource.name}` : ''} · payout ${rs(payout)}` +
        (supplier > 0 ? ` · of which ${rs(supplier)} is supplier money (cover cost)` : '') +
        (oldPaidCover > 0 ? ` − cover cost ${rs(oldPaidCover)} (supplier paid from it)` : '') +
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

  // ± Leopards invoice: the part of the invoice that is not the money of the orders it paid
  for (const inv of invoices) {
    const paid = paidByInvoice.get(inv.invoiceNo) || { payout: 0, orders: new Set<string>() }
    const amount = r2(inv.amount - paid.payout)
    if (Math.abs(amount) < 0.5) continue
    push({
      id: `lcs:${inv.invoiceNo}`,
      personId: inv.receivedById as string,
      date: inv.receivedAt as Date,
      kind: 'courier',
      amount,
      title: `Leopards invoice ${inv.invoiceNo}`,
      detail:
        `Invoice ${rs(inv.amount)} − orders paid in it ${rs(paid.payout)}${paid.orders.size ? ` (${Array.from(paid.orders).join(', ')})` : ''}` +
        (amount < 0 ? ' · Leopards also took the charges of orders paid in another invoice / returned' : ' · charges of these orders were taken in an earlier invoice'),
    })
  }

  // − Supplier paid by a person: one entry per order per payer.
  //   The cover cost was supplier money (from the order's payout); paying it takes it out again.
  //   For a cancelled / returned order there is no order money to cover it, so it is plain cost.
  const sups = new Map<string, typeof supplierPaid>()
  for (const s of supplierPaid) {
    if (!coverOwed(s)) continue
    const key = `${s.supplierPaidById}|${s.orderNo != null ? `#${s.orderNo}` : s.parcelId || s.id}`
    sups.set(key, [...(sups.get(key) || []), s])
  }
  for (const [key, rows] of Array.from(sups.entries())) {
    const lead = rows[0]
    const cover = r2(rows.reduce((a, s) => a + coverOwed(s), 0))
    const stillSelling = lead.status !== 'CANCELLED' && lead.status !== 'RETURNED'
    const names = Array.from(new Set(rows.map((s) => s.supplier?.name).filter(Boolean)))
    push({
      id: `sup:${key}`,
      personId: lead.supplierPaidById as string,
      date: lead.supplierPaidAt || lead.createdAt,
      kind: 'supplier',
      amount: -cover,
      supplier: stillSelling ? -cover : 0,
      title: `Supplier paid${lead.orderNo != null ? ` · order #${lead.orderNo}` : ''}`,
      detail: `${names.length ? names.join(', ') : 'supplier'} · cover cost for ${lead.customerName}${stillSelling ? '' : ` (order ${lead.status.toLowerCase()})`}`,
      orderNo: lead.orderNo,
    })
  }

  // ± Money sent between people (bank transfer)
  for (const t of transfers) {
    const detail = [t.note, t.createdBy ? `by ${t.createdBy}` : ''].filter(Boolean).join(' · ')
    push({
      id: `tr:${t.id}:out`,
      personId: t.fromId,
      date: t.date,
      kind: 'transfer',
      amount: -t.amount,
      supplier: -t.supplierPart,
      title: `Sent to ${t.to.name}`,
      detail,
      refId: t.id,
    })
    push({
      id: `tr:${t.id}:in`,
      personId: t.toId,
      date: t.date,
      kind: 'transfer',
      amount: t.amount,
      supplier: t.supplierPart,
      title: `Received from ${t.from.name}`,
      detail,
      refId: t.id,
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

// Supplier money (cover cost still to pay) inside a person's In hand. Can be below 0 when the person
// paid a supplier before the order money came in (it comes back when the order is paid).
export const sumSupplier = (entries: LedgerEntry[]) => r2(entries.reduce((a, e) => a + (e.supplier || 0), 0))

// In hand split: supplier money (not to spend) and own money (free to use / withdraw)
export function splitInHand(entries: LedgerEntry[]) {
  const inHand = sumLedger(entries)
  const supplier = sumSupplier(entries)
  return { inHand, supplier, own: r2(inHand - Math.max(0, supplier)) }
}
