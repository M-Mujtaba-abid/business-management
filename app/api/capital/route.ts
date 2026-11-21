import { NextResponse } from 'next/server'
import prisma from '@/lib/prisma'
import { capitalByPerson } from '@/lib/capital'

export const dynamic = 'force-dynamic'

// Payments → Capital card: each partner's own money in the business, with the lines behind it
export async function GET() {
  try {
    const [rows, investments, stock, back] = await Promise.all([
      capitalByPerson(prisma),
      prisma.moneyEntry.findMany({ where: { kind: 'INVESTMENT' }, orderBy: { date: 'desc' }, select: { id: true, personId: true, amount: true, date: true, note: true } }),
      prisma.stockPayment.findMany({
        where: { kind: 'SAVINGS' },
        orderBy: { createdAt: 'desc' },
        select: { id: true, personId: true, amount: true, createdAt: true, purchase: { select: { quantity: true, item: { select: { name: true } } } } },
      }),
      prisma.withdrawal.findMany({ where: { type: 'CAPITAL' }, orderBy: { createdAt: 'desc' }, select: { id: true, personId: true, amount: true, createdAt: true, reason: true } }),
    ])
    const lines = [
      ...investments.map((i) => ({ id: `inv:${i.id}`, personId: i.personId, date: i.date, kind: 'cash', amount: i.amount, note: i.note || '' })),
      ...stock.map((s) => ({ id: `stk:${s.id}`, personId: s.personId, date: s.createdAt, kind: 'stock', amount: s.amount, note: `${s.purchase.quantity} × ${s.purchase.item.name}` })),
      ...back.map((w) => ({ id: `back:${w.id}`, personId: w.personId, date: w.createdAt, kind: 'back', amount: -w.amount, note: w.reason || '' })),
    ].sort((a, b) => b.date.getTime() - a.date.getTime())
    return NextResponse.json({ people: rows, lines })
  } catch (error: any) {
    return NextResponse.json({ error: error.message || 'Could not load capital' }, { status: 500 })
  }
}
