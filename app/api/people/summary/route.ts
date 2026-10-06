import { NextRequest, NextResponse } from 'next/server'
import prisma from '@/lib/prisma'
import { payoutAmount } from '@/lib/saleMoney'

export const dynamic = 'force-dynamic'

// Per person:
//  - received:   order money received (actual payout minus cover cost, since the cover cost is owed back to the supplier)
//  - expenses:   business expenses paid from their money
//  - withdrawn:  money they took out
//  - inHand:     received - expenses - withdrawn, all time (what they should be holding now)
//  - expected:   delivered orders whose money has not come in yet
// received / expenses / withdrawn are for the selected period; inHand and expected are all time.
export async function GET(request: NextRequest) {
  try {
    const { searchParams } = new URL(request.url)
    const from = searchParams.get('from') // YYYY-MM-DD, inclusive
    const to = searchParams.get('to') // YYYY-MM-DD, inclusive

    const range: { gte?: Date; lte?: Date } = {}
    if (from) {
      const [y, m, d] = from.split('-').map(Number)
      range.gte = new Date(y, m - 1, d, 0, 0, 0, 0)
    }
    if (to) {
      const [y, m, d] = to.split('-').map(Number)
      range.lte = new Date(y, m - 1, d, 23, 59, 59, 999)
    }
    const inRange = (date: Date | null) =>
      !!date && (!range.gte || date >= range.gte) && (!range.lte || date <= range.lte)

    const [people, received, expected, expenses, withdrawals] = await Promise.all([
      prisma.person.findMany({ orderBy: { name: 'asc' } }),
      prisma.sale.findMany({
        where: { paymentStatus: 'RECEIVED' },
        select: { receivedById: true, soldPrice: true, costPrice: true, quantity: true, receivedAmount: true, paymentReceivedAt: true },
      }),
      prisma.sale.findMany({
        where: { paymentStatus: 'NOT_RECEIVED', status: 'DELIVERED' },
        select: { receivedById: true, soldPrice: true, costPrice: true, quantity: true, receivedAmount: true },
      }),
      prisma.expense.findMany({
        where: { paidById: { not: null } },
        select: { paidById: true, amount: true, createdAt: true },
      }),
      prisma.withdrawal.findMany({
        select: { personId: true, amount: true, createdAt: true },
      }),
    ])

    // Actual payout (edited received amount, else full sale) minus the cover cost owed to the supplier
    const net = (s: { soldPrice: number; costPrice: number; quantity: number; receivedAmount: number | null }) =>
      payoutAmount(s) - s.costPrice * s.quantity
    const sum = (list: number[]) => list.reduce((acc, n) => acc + n, 0)

    const build = (id: string | null, name: string) => {
      const got = received.filter((s) => s.receivedById === id)
      const gotInPeriod = got.filter((s) => inRange(s.paymentReceivedAt))
      const coming = expected.filter((s) => s.receivedById === id)
      const spent = id ? expenses.filter((e) => e.paidById === id) : []
      const spentInPeriod = spent.filter((e) => inRange(e.createdAt))
      const taken = id ? withdrawals.filter((w) => w.personId === id) : []
      const takenInPeriod = taken.filter((w) => inRange(w.createdAt))

      return {
        id,
        name,
        receivedAmount: sum(gotInPeriod.map(net)),
        receivedCount: gotInPeriod.length,
        expensesAmount: sum(spentInPeriod.map((e) => e.amount)),
        expensesCount: spentInPeriod.length,
        withdrawnAmount: sum(takenInPeriod.map((w) => w.amount)),
        withdrawnCount: takenInPeriod.length,
        inHand: sum(got.map(net)) - sum(spent.map((e) => e.amount)) - sum(taken.map((w) => w.amount)),
        expectedAmount: sum(coming.map(net)),
        expectedCount: coming.length,
      }
    }

    const summary = people.map((p) => build(p.id, p.name))

    // Orders saved without a person
    const unassigned = build(null, 'No person set')
    if (unassigned.receivedCount > 0 || unassigned.expectedCount > 0 || unassigned.inHand !== 0) summary.push(unassigned)

    return NextResponse.json(summary)
  } catch (error: any) {
    return NextResponse.json({ error: error.message || 'Failed to fetch money summary' }, { status: 500 })
  }
}
