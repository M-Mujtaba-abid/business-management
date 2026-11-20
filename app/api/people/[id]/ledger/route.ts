import { NextRequest, NextResponse } from 'next/server'
import prisma from '@/lib/prisma'
import { buildLedger, LedgerKind, sumLedger } from '@/lib/personLedger'

export const dynamic = 'force-dynamic'

// A person's money statement.
// GET ?from=YYYY-MM-DD&to=YYYY-MM-DD (both optional, inclusive)
//  → { person, opening, entries: [{…, balance}] (newest first), totals: {in, out, byKind}, closing, inHandNow }
//    opening = balance before `from`; closing = opening + entries in the range; inHandNow = all-time balance.
export async function GET(request: NextRequest, { params }: { params: { id: string } }) {
  try {
    const person = await prisma.person.findUnique({ where: { id: params.id }, select: { id: true, name: true } })
    if (!person) return NextResponse.json({ error: 'Person not found' }, { status: 404 })

    const sp = request.nextUrl.searchParams
    const day = (v: string | null, end: boolean) => {
      if (!v) return null
      const [y, m, d] = v.split('-').map(Number)
      return end ? new Date(y, m - 1, d, 23, 59, 59, 999) : new Date(y, m - 1, d, 0, 0, 0, 0)
    }
    const from = day(sp.get('from'), false)
    const to = day(sp.get('to'), true)

    const all = (await buildLedger(prisma, person.id)).get(person.id) || []
    const before = from ? all.filter((e) => e.date < from) : []
    const inRange = all.filter((e) => (!from || e.date >= from) && (!to || e.date <= to))

    const opening = sumLedger(before)
    let balance = opening
    const withBalance = inRange.map((e) => {
      balance = Math.round((balance + e.amount) * 100) / 100
      return { ...e, balance }
    })

    const byKind: Record<LedgerKind, { count: number; amount: number }> = {
      order: { count: 0, amount: 0 },
      expense: { count: 0, amount: 0 },
      withdrawal: { count: 0, amount: 0 },
      dc: { count: 0, amount: 0 },
      stock: { count: 0, amount: 0 },
    }
    for (const e of inRange) {
      byKind[e.kind].count++
      byKind[e.kind].amount = Math.round((byKind[e.kind].amount + e.amount) * 100) / 100
    }
    const money = (list: number[]) => Math.round(list.reduce((a, n) => a + n, 0) * 100) / 100

    return NextResponse.json({
      person,
      from: sp.get('from') || null,
      to: sp.get('to') || null,
      opening,
      entries: withBalance.reverse(), // newest first
      totals: {
        in: money(inRange.filter((e) => e.amount > 0).map((e) => e.amount)),
        out: money(inRange.filter((e) => e.amount < 0).map((e) => e.amount)),
        byKind,
      },
      closing: balance,
      inHandNow: sumLedger(all),
    })
  } catch (error: any) {
    console.error('Person ledger error:', error)
    return NextResponse.json({ error: error.message || 'Could not load the statement' }, { status: 500 })
  }
}
