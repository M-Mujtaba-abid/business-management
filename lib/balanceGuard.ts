// Stops any change that would push a person's "In hand" money below zero.
//
// In hand (all time) = order money received (payout - cover cost) - expenses paid - withdrawals - DC paid.
// Same maths as /api/people/summary.
//
// Use withBalanceGuard() around a write: it measures every person's balance before and after the
// write inside one transaction, and rolls the write back if someone ends up below zero
// (only when this change made it worse, so fixing an already-negative balance is never blocked).
import { Prisma } from '@prisma/client'
import prisma from '@/lib/prisma'
import { payoutAmount } from '@/lib/saleMoney'

type Db = Prisma.TransactionClient

// Rounding to paisa can leave tiny remainders; the screen shows whole rupees
const TOLERANCE = 0.5

export class NegativeBalanceError extends Error {
  constructor(public personName: string, public before: number, public after: number) {
    super(
      `${personName} has ${rs(before)} in hand. This change would make it ${rs(after)}. ` +
        `Not allowed - a balance cannot go below zero.`
    )
    this.name = 'NegativeBalanceError'
  }
}

const rs = (n: number) => `Rs. ${Math.round(n).toLocaleString('en-PK')}`

// Order money that counts for the person who received it
export const orderNet = (s: { soldPrice: number; costPrice: number; quantity: number; receivedAmount: number | null }) =>
  payoutAmount(s) - s.costPrice * s.quantity

export async function inHandByPerson(db: Db): Promise<Map<string, { name: string; inHand: number }>> {
  const [people, received, expenses, withdrawals, dcPaid] = await Promise.all([
    db.person.findMany({ select: { id: true, name: true } }),
    db.sale.findMany({
      where: { paymentStatus: 'RECEIVED', receivedById: { not: null } },
      select: { receivedById: true, soldPrice: true, costPrice: true, quantity: true, receivedAmount: true },
    }),
    db.expense.findMany({ where: { paidById: { not: null } }, select: { paidById: true, amount: true } }),
    db.withdrawal.findMany({ select: { personId: true, amount: true } }),
    db.sale.findMany({
      where: { dcPaidById: { not: null }, status: { not: 'CANCELLED' } },
      select: { dcPaidById: true, deliveryCharge: true },
    }),
  ])

  const map = new Map(people.map((p) => [p.id, { name: p.name, inHand: 0 }]))
  const add = (id: string | null, n: number) => {
    const row = id ? map.get(id) : undefined
    if (row) row.inHand += n
  }
  for (const s of received) add(s.receivedById, orderNet(s))
  for (const e of expenses) add(e.paidById, -e.amount)
  for (const w of withdrawals) add(w.personId, -w.amount)
  for (const s of dcPaid) add(s.dcPaidById, -s.deliveryCharge)
  return map
}

export async function withBalanceGuard<T>(write: (tx: Db) => Promise<T>): Promise<T> {
  return prisma.$transaction(async (tx) => {
    const before = await inHandByPerson(tx)
    const result = await write(tx)
    const after = await inHandByPerson(tx)

    for (const [id, a] of after) {
      const b = before.get(id)?.inHand ?? 0
      if (a.inHand < -TOLERANCE && a.inHand < b - 0.005) {
        throw new NegativeBalanceError(a.name, b, a.inHand)
      }
    }
    return result
  })
}

// For route catch blocks: a blocked change is the user's mistake (400), not a server error
export const balanceErrorResponse = (error: unknown) =>
  error instanceof NegativeBalanceError ? { error: error.message, negativeBalance: true } : null
