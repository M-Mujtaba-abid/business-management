// Each partner's capital: their own (personal) money put into the business.
//   put in (cash)   MoneyEntry INVESTMENT
//   put in (stock)  StockPayment SAVINGS (inventory bought from personal savings)
//   taken back      Withdrawal type CAPITAL
//   net capital     put in − taken back
import type { Prisma } from '@prisma/client'

type Db = Prisma.TransactionClient
const r2 = (n: number) => Math.round(n * 100) / 100

export interface CapitalRow {
  id: string
  name: string
  cashIn: number
  stockIn: number
  takenBack: number
  net: number
}

export async function capitalByPerson(db: Db): Promise<CapitalRow[]> {
  const [people, investments, stock, back] = await Promise.all([
    db.person.findMany({ orderBy: { name: 'asc' }, select: { id: true, name: true } }),
    db.moneyEntry.groupBy({ by: ['personId'], where: { kind: 'INVESTMENT' }, _sum: { amount: true } }),
    db.stockPayment.groupBy({ by: ['personId'], where: { kind: 'SAVINGS' }, _sum: { amount: true } }),
    db.withdrawal.groupBy({ by: ['personId'], where: { type: 'CAPITAL' }, _sum: { amount: true } }),
  ])
  const sumOf = (list: { personId: string; _sum: { amount: number | null } }[], id: string) => list.find((x) => x.personId === id)?._sum.amount || 0
  return people.map((p) => {
    const cashIn = r2(sumOf(investments, p.id))
    const stockIn = r2(sumOf(stock, p.id))
    const takenBack = r2(sumOf(back, p.id))
    return { id: p.id, name: p.name, cashIn, stockIn, takenBack, net: r2(cashIn + stockIn - takenBack) }
  })
}
