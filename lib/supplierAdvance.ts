// Supplier advances: money given to a supplier before the stock arrives.
//  - giving it takes it out of the giver's In hand (ledger kind 'advance')
//  - stock bought later "from advance" (StockPayment kind ADVANCE) uses it up without a second cut
//  - left with the supplier = given − used, per supplier and per person who gave it
import type { Prisma } from '@prisma/client'

type Db = Prisma.TransactionClient

const r2 = (n: number) => Math.round(n * 100) / 100

export class AdvanceError extends Error {
  constructor(message: string) {
    super(message)
    this.name = 'AdvanceError'
  }
}
export const advanceErrorResponse = (error: unknown) =>
  error instanceof AdvanceError || (error as any)?.name === 'AdvanceError' ? { error: (error as Error).message } : null

export interface AdvanceBalance {
  supplierId: string
  personId: string
  given: number
  used: number
  left: number
}

// Given / used / left for every (supplier, person) pair, or only one supplier
export async function advanceBalances(db: Db, supplierId?: string): Promise<AdvanceBalance[]> {
  const [given, used] = await Promise.all([
    db.supplierAdvance.groupBy({ by: ['supplierId', 'personId'], where: supplierId ? { supplierId } : {}, _sum: { amount: true } }),
    db.stockPayment.findMany({
      where: { kind: 'ADVANCE', ...(supplierId ? { purchase: { supplierId } } : {}) },
      select: { personId: true, amount: true, purchase: { select: { supplierId: true } } },
    }),
  ])
  const map = new Map<string, AdvanceBalance>()
  const row = (s: string, p: string) => {
    const k = `${s}|${p}`
    if (!map.has(k)) map.set(k, { supplierId: s, personId: p, given: 0, used: 0, left: 0 })
    return map.get(k)!
  }
  for (const g of given) row(g.supplierId, g.personId).given += g._sum.amount || 0
  for (const u of used) if (u.purchase.supplierId) row(u.purchase.supplierId, u.personId).used += u.amount
  return Array.from(map.values()).map((b) => ({ ...b, given: r2(b.given), used: r2(b.used), left: r2(b.given - b.used) }))
}

export async function advanceLeft(db: Db, supplierId: string, personId: string) {
  const b = (await advanceBalances(db, supplierId)).find((x) => x.personId === personId)
  return b ? b.left : 0
}
