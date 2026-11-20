import { NextRequest, NextResponse } from 'next/server'
import prisma from '@/lib/prisma'
import { countOrders } from '@/lib/saleMoney'
import { buildLedger, orderNet, sumLedger } from '@/lib/personLedger'

export const dynamic = 'force-dynamic'

// Per person:
//  - received:   order money received (actual payout minus cover cost, since the cover cost is owed back to the supplier)
//  - expenses:   business expenses paid from their money
//  - withdrawn:  money they took out
//  - dc:         delivery charges paid from their account (by order date; cancelled orders left out)
//  - inHand:     received - expenses - withdrawn - dc, all time (what they should be holding now)
//  - expected:   delivered orders whose money has not come in yet
// received / expenses / withdrawn / dc are for the selected period; inHand and expected are all time.
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

    const ledger = await buildLedger(prisma)
    // Last bank check of each person (shown on their card)
    const lastChecks = await prisma.bankCheck.findMany({ orderBy: { createdAt: 'desc' }, distinct: ['personId'] })
    const lastCheckOf = new Map(lastChecks.map((c) => [c.personId, c]))
    const [people, received, expected, expenses, withdrawals, dcPaid, stockPaid] = await Promise.all([
      prisma.person.findMany({ orderBy: { name: 'asc' } }),
      prisma.sale.findMany({
        where: { paymentStatus: 'RECEIVED' },
        select: { id: true, parcelId: true, receivedById: true, soldPrice: true, costPrice: true, quantity: true, receivedAmount: true, paymentReceivedAt: true, inventoryItemId: true },
      }),
      prisma.sale.findMany({
        where: { paymentStatus: 'NOT_RECEIVED', status: 'DELIVERED' },
        select: { id: true, parcelId: true, receivedById: true, soldPrice: true, costPrice: true, quantity: true, receivedAmount: true, inventoryItemId: true },
      }),
      prisma.expense.findMany({
        where: { paidById: { not: null } },
        select: { paidById: true, amount: true, createdAt: true },
      }),
      prisma.withdrawal.findMany({
        select: { personId: true, amount: true, createdAt: true },
      }),
      prisma.sale.findMany({
        where: { dcPaidById: { not: null }, status: { not: 'CANCELLED' } },
        select: { id: true, parcelId: true, dcPaidById: true, deliveryCharge: true, createdAt: true },
      }),
      // Stock bought (Inventory): from in hand lowers the balance; from savings is an investment
      prisma.stockPayment.findMany({ select: { personId: true, amount: true, kind: true, purchaseId: true, createdAt: true } }),
    ])

    // Same formula as lib/balanceGuard.ts (orderNet): payout minus the cover cost owed to the supplier;
    // stock sold from our inventory was already paid when bought, so its full payout counts
    const net = orderNet
    const sum = (list: number[]) => list.reduce((acc, n) => acc + n, 0)

    const build = (id: string | null, name: string) => {
      const got = received.filter((s) => s.receivedById === id)
      const gotInPeriod = got.filter((s) => inRange(s.paymentReceivedAt))
      const coming = expected.filter((s) => s.receivedById === id)
      const spent = id ? expenses.filter((e) => e.paidById === id) : []
      const spentInPeriod = spent.filter((e) => inRange(e.createdAt))
      const taken = id ? withdrawals.filter((w) => w.personId === id) : []
      const takenInPeriod = taken.filter((w) => inRange(w.createdAt))
      const dc = id ? dcPaid.filter((s) => s.dcPaidById === id) : []
      const dcInPeriod = dc.filter((s) => inRange(s.createdAt))
      const mine = id ? stockPaid.filter((p) => p.personId === id) : []
      const stockFromHand = mine.filter((p) => p.kind === 'BUSINESS')
      const stockFromHandInPeriod = stockFromHand.filter((p) => inRange(p.createdAt))
      const savings = mine.filter((p) => p.kind === 'SAVINGS')

      return {
        id,
        name,
        receivedAmount: sum(gotInPeriod.map(net)),
        receivedCount: countOrders(gotInPeriod),
        expensesAmount: sum(spentInPeriod.map((e) => e.amount)),
        expensesCount: spentInPeriod.length,
        withdrawnAmount: sum(takenInPeriod.map((w) => w.amount)),
        withdrawnCount: takenInPeriod.length,
        dcAmount: sum(dcInPeriod.map((s) => s.deliveryCharge)),
        dcCount: countOrders(dcInPeriod),
        stockAmount: sum(stockFromHandInPeriod.map((p) => p.amount)),
        stockCount: new Set(stockFromHandInPeriod.map((p) => p.purchaseId)).size,
        investedAmount: sum(savings.map((p) => p.amount)), // all time, from personal savings
        // All time, from the person's money statement (same entries as the Statement window)
        inHand: id ? sumLedger(ledger.get(id) || []) : sum(got.map(net)),
        lastBankCheck: id ? lastCheckOf.get(id) ?? null : null,
        expectedAmount: sum(coming.map(net)),
        expectedCount: countOrders(coming),
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
