// Inventory: our own stock. Every change goes through here, inside the caller's transaction,
// and leaves a line in the item's log (InventoryLog) and, for orders, in the order history (OrderLog).
//
// Rules (agreed with the owner):
//  - an order item "From inventory" takes the stock when the order is SAVED (holdStock)
//  - the stock comes back on cancel, delete, item removed, or return with the item back (releaseStock)
//  - Sale.inventoryHeld says whether a row currently holds stock, so nothing is taken or given back twice
import type { Prisma } from '@prisma/client'
import type { Actor } from '@/lib/orderLog'
import { advanceLeft } from '@/lib/supplierAdvance'

type Db = Prisma.TransactionClient

export class InventoryError extends Error {
  constructor(message: string) {
    super(message)
    this.name = 'InventoryError'
  }
}

// For route catch blocks: a stock problem is the user's to fix (400), not a server error
export const inventoryErrorResponse = (error: unknown) =>
  error instanceof InventoryError || (error as any)?.name === 'InventoryError' ? { error: (error as Error).message } : null

const rs = (n: number) => `Rs. ${Math.round(n).toLocaleString('en-PK')}`
const round2 = (n: number) => Math.round(n * 100) / 100

export interface InvLogInput {
  itemId: string
  action: string
  qtyChange: number
  qtyAfter: number
  message: string
  actor: Actor
  unitCost?: number | null
  amount?: number | null
  orderNo?: number | null
  saleId?: string | null
  purchaseId?: string | null
  details?: Record<string, unknown>
}

export async function logInventory(db: Db, e: InvLogInput) {
  await db.inventoryLog.create({
    data: {
      itemId: e.itemId,
      action: e.action,
      qtyChange: e.qtyChange,
      qtyAfter: e.qtyAfter,
      unitCost: e.unitCost ?? null,
      amount: e.amount ?? null,
      orderNo: e.orderNo ?? null,
      saleId: e.saleId ?? null,
      purchaseId: e.purchaseId ?? null,
      message: e.message.slice(0, 1000),
      source: e.actor.source,
      actor: e.actor.name ?? null,
      details: (e.details ?? undefined) as Prisma.InputJsonValue | undefined,
    },
  })
}

async function orderNote(db: Db, row: InvRow, action: string, message: string, actor: Actor, details: Record<string, unknown>) {
  await db.orderLog.create({
    data: {
      orderNo: row.orderNo ?? null,
      saleId: row.orderNo != null ? null : row.id,
      action,
      message,
      source: actor.source,
      actor: actor.name ?? null,
      details: details as Prisma.InputJsonValue,
    },
  })
}

export interface InvRow {
  id: string
  inventoryItemId: string | null
  inventoryHeld: boolean
  quantity: number
  orderNo: number | null
  costPrice?: number
}

// The current average cost of an item: what a new order item from inventory costs us
export async function itemCost(db: Db, itemId: string): Promise<{ name: string; avgCost: number; stockQty: number; active: boolean }> {
  const item = await db.inventoryItem.findUnique({ where: { id: itemId }, select: { name: true, avgCost: true, stockQty: true, active: true } })
  if (!item) throw new InventoryError('An inventory item you picked no longer exists.')
  return item
}

// Take stock for the rows that use an inventory item and do not hold it yet.
// Refuses (rolls the whole save back) when there is not enough stock.
// noteOrder=false: the caller mentions it in its own order-history line (e.g. "Order created")
export async function holdStock(db: Db, rows: InvRow[], actor: Actor, opts: { noteOrder?: boolean } = {}) {
  for (const r of rows) {
    if (!r.inventoryItemId || r.inventoryHeld || r.quantity <= 0) continue
    const taken = await db.inventoryItem.updateMany({
      where: { id: r.inventoryItemId, stockQty: { gte: r.quantity } },
      data: { stockQty: { decrement: r.quantity } },
    })
    const item = await db.inventoryItem.findUnique({ where: { id: r.inventoryItemId }, select: { name: true, stockQty: true, avgCost: true } })
    if (!item) throw new InventoryError('An inventory item you picked no longer exists.')
    if (taken.count === 0) {
      throw new InventoryError(`Not enough stock of "${item.name}": only ${item.stockQty} left, this order needs ${r.quantity}.`)
    }
    await db.sale.update({ where: { id: r.id }, data: { inventoryHeld: true } })
    const cost = r.costPrice ?? item.avgCost
    await logInventory(db, {
      itemId: r.inventoryItemId,
      action: 'sold',
      qtyChange: -r.quantity,
      qtyAfter: item.stockQty,
      unitCost: cost,
      amount: round2(cost * r.quantity),
      orderNo: r.orderNo,
      saleId: r.id,
      message: `${r.quantity} taken for order${r.orderNo != null ? ` #${r.orderNo}` : ''} · ${item.stockQty} left`,
      actor,
    })
    if (opts.noteOrder !== false) {
      await orderNote(db, r, 'inventory', `Took ${r.quantity} × ${item.name} from inventory (${item.stockQty} left)`, actor, {
        itemId: r.inventoryItemId,
        qty: r.quantity,
        left: item.stockQty,
      })
    }
  }
}

// Give stock back for rows that hold it. kind: 'released' (cancel / delete / removed / edited)
// or 'returned_back' (the order came back with the item).
export async function releaseStock(db: Db, rows: InvRow[], kind: 'released' | 'returned_back', reason: string, actor: Actor) {
  for (const r of rows) {
    if (!r.inventoryItemId || !r.inventoryHeld || r.quantity <= 0) continue
    const item = await db.inventoryItem.update({
      where: { id: r.inventoryItemId },
      data: { stockQty: { increment: r.quantity } },
      select: { name: true, stockQty: true },
    })
    await db.sale.updateMany({ where: { id: r.id }, data: { inventoryHeld: false } })
    await logInventory(db, {
      itemId: r.inventoryItemId,
      action: kind,
      qtyChange: r.quantity,
      qtyAfter: item.stockQty,
      unitCost: r.costPrice ?? null,
      orderNo: r.orderNo,
      saleId: r.id,
      message: `${r.quantity} back in stock (${reason}${r.orderNo != null ? `, order #${r.orderNo}` : ''}) · ${item.stockQty} in stock`,
      actor,
    })
    await orderNote(db, r, 'inventory', `${r.quantity} × ${item.name} back to inventory (${reason})`, actor, {
      itemId: r.inventoryItemId,
      qty: r.quantity,
      reason,
    })
  }
}

// Weighted average cost after buying more
export const newAverage = (stockQty: number, avgCost: number, qty: number, unitCost: number) =>
  stockQty <= 0 ? unitCost : round2((stockQty * avgCost + qty * unitCost) / (stockQty + qty))

export interface PaymentInput {
  personId: string
  amount: number
  kind: 'BUSINESS' | 'SAVINGS' | 'ADVANCE'
}

// Buying stock: adds it, updates the average cost, saves who paid, and logs it.
// Payments must add up to the total cost.
export async function addPurchase(
  db: Db,
  input: { itemId: string; quantity: number; unitCost: number; supplierId?: string | null; note?: string | null; payments: PaymentInput[] },
  actor: Actor,
  names: { people: Map<string, string>; suppliers: Map<string, string> }
) {
  const qty = Math.round(input.quantity)
  const unit = round2(input.unitCost)
  if (!Number.isInteger(qty) || qty <= 0) throw new InventoryError('Enter how many you bought (1 or more).')
  if (!(unit >= 0)) throw new InventoryError('Enter a valid buy price.')
  const total = round2(qty * unit)
  const payments = input.payments.filter((p) => p.amount > 0)
  const paid = round2(payments.reduce((a, p) => a + p.amount, 0))
  if (Math.abs(paid - total) > 0.5) {
    throw new InventoryError(`Who paid must add up to the total ${rs(total)} (now ${rs(paid)}).`)
  }
  for (const p of payments) {
    if (!names.people.has(p.personId)) throw new InventoryError('Pick who paid.')
    if (p.kind !== 'BUSINESS' && p.kind !== 'SAVINGS' && p.kind !== 'ADVANCE') throw new InventoryError('Pick "In hand", "Savings" or "Advance" for each payment.')
  }
  // From advance: only what that person already gave this supplier and is not used yet
  const fromAdvance = new Map<string, number>()
  for (const p of payments) if (p.kind === 'ADVANCE') fromAdvance.set(p.personId, round2((fromAdvance.get(p.personId) || 0) + p.amount))
  if (fromAdvance.size) {
    if (!input.supplierId) throw new InventoryError('Pick the supplier to pay from their advance.')
    for (const [personId, amount] of Array.from(fromAdvance.entries())) {
      const left = await advanceLeft(db, input.supplierId, personId)
      if (amount > left + 0.5) {
        throw new InventoryError(
          `${names.people.get(personId)} has only ${rs(left)} advance left with ${names.suppliers.get(input.supplierId) || 'this supplier'} (this needs ${rs(amount)}).`
        )
      }
    }
  }

  const item = await db.inventoryItem.findUnique({ where: { id: input.itemId } })
  if (!item) throw new InventoryError('Inventory item not found.')
  const avg = newAverage(item.stockQty, item.avgCost, qty, unit)

  const purchase = await db.stockPurchase.create({
    data: {
      itemId: item.id,
      quantity: qty,
      unitCost: unit,
      totalCost: total,
      supplierId: input.supplierId || null,
      note: input.note?.trim() || null,
      createdBy: actor.name ?? null,
      payments: { create: payments.map((p) => ({ personId: p.personId, amount: round2(p.amount), kind: p.kind })) },
    },
  })
  const updated = await db.inventoryItem.update({
    where: { id: item.id },
    data: { stockQty: { increment: qty }, avgCost: avg, ...(input.supplierId && !item.supplierId ? { supplierId: input.supplierId } : {}) },
  })

  const who = payments
    .map((p) => `${names.people.get(p.personId)} ${rs(p.amount)} ${p.kind === 'SAVINGS' ? 'from savings' : p.kind === 'ADVANCE' ? 'from advance' : 'from in hand'}`)
    .join(' + ')
  const supplier = input.supplierId ? names.suppliers.get(input.supplierId) : null
  await logInventory(db, {
    itemId: item.id,
    action: 'stock_in',
    qtyChange: qty,
    qtyAfter: updated.stockQty,
    unitCost: unit,
    amount: total,
    purchaseId: purchase.id,
    message:
      `Bought ${qty} @ ${rs(unit)} = ${rs(total)}${supplier ? ` from ${supplier}` : ''} · paid by ${who || 'nobody'}` +
      ` · ${updated.stockQty} in stock · avg cost ${rs(avg)}`,
    actor,
    details: { payments, supplier, note: input.note || null, avgBefore: item.avgCost, avgAfter: avg },
  })
  return { purchase, item: updated }
}
