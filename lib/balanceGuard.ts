// Stops any change that would push a person's "In hand" money below zero.
//
// In hand (all time) = the sum of the person's money statement (lib/personLedger.ts):
// order money received (payout − cover cost; inventory sales: full payout) − expenses paid
// − withdrawals − DC paid − stock bought from in hand.
//
// Use withBalanceGuard() around a write: it measures every person's balance before and after the
// write inside one transaction, and rolls the write back if someone ends up below zero
// (only when this change made it worse, so fixing an already-negative balance is never blocked).
import { Prisma } from '@prisma/client'
import prisma from '@/lib/prisma'
import { buildLedger, sumLedger } from '@/lib/personLedger'

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

// The money rules live in lib/personLedger.ts (one list of entries per person); In hand is their sum
export { orderNet } from '@/lib/personLedger'

export async function inHandByPerson(db: Db): Promise<Map<string, { name: string; inHand: number }>> {
  const [people, ledger] = await Promise.all([db.person.findMany({ select: { id: true, name: true } }), buildLedger(db)])
  return new Map(people.map((p) => [p.id, { name: p.name, inHand: sumLedger(ledger.get(p.id) || []) }]))
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
