import { NextRequest, NextResponse } from 'next/server'
import prisma from '@/lib/prisma'
import { withBalanceGuard, balanceErrorResponse } from '@/lib/balanceGuard'
import { advanceBalances, advanceErrorResponse } from '@/lib/supplierAdvance'
import { requestActor } from '@/lib/orderLog'

export const dynamic = 'force-dynamic'

const r2 = (n: number) => Math.round(n * 100) / 100

// GET → { balances: [{ supplierId, supplier, personId, person, given, used, left }],
//         advances: [...latest], usedLines: [...stock bought from an advance],
//         withdrawals: [...profit withdrawals that can be turned into an advance] }
export async function GET() {
  try {
    const [balances, advances, used, withdrawals, suppliers, people] = await Promise.all([
      advanceBalances(prisma),
      prisma.supplierAdvance.findMany({ orderBy: { date: 'desc' }, take: 100, include: { supplier: { select: { name: true } }, person: { select: { name: true } } } }),
      prisma.stockPayment.findMany({
        where: { kind: 'ADVANCE' },
        orderBy: { createdAt: 'desc' },
        take: 100,
        select: {
          id: true,
          personId: true,
          amount: true,
          createdAt: true,
          purchase: { select: { quantity: true, unitCost: true, supplierId: true, item: { select: { name: true } } } },
        },
      }),
      prisma.withdrawal.findMany({ where: { type: 'PROFIT' }, orderBy: { createdAt: 'desc' }, take: 30, include: { person: { select: { name: true } } } }),
      prisma.supplier.findMany({ select: { id: true, name: true } }),
      prisma.person.findMany({ select: { id: true, name: true } }),
    ])
    const sup = new Map(suppliers.map((s) => [s.id, s.name]))
    const ppl = new Map(people.map((p) => [p.id, p.name]))
    return NextResponse.json({
      balances: balances
        .map((b) => ({ ...b, supplier: sup.get(b.supplierId) || '?', person: ppl.get(b.personId) || '?' }))
        .sort((a, b) => b.left - a.left),
      advances,
      usedLines: used.map((u) => ({
        id: u.id,
        personId: u.personId,
        person: ppl.get(u.personId) || '?',
        supplierId: u.purchase.supplierId,
        supplier: (u.purchase.supplierId && sup.get(u.purchase.supplierId)) || '?',
        amount: u.amount,
        date: u.createdAt,
        note: `${u.purchase.quantity} × ${u.purchase.item.name} @ Rs. ${Math.round(u.purchase.unitCost).toLocaleString('en-PK')}`,
      })),
      withdrawals,
    })
  } catch (error: any) {
    return NextResponse.json({ error: error.message || 'Could not load advances' }, { status: 500 })
  }
}

// Give a supplier an advance for stock (it leaves the giver's In hand now).
// POST { supplierId, personId, amount, date?, note? }
// POST { supplierId, fromWithdrawalId, note? }  → a withdrawal that was really this advance:
//      the withdrawal is removed and the same amount / person / date becomes the advance (In hand stays the same)
export async function POST(request: NextRequest) {
  try {
    const body = await request.json().catch(() => ({}))
    const supplierId = String(body.supplierId || '')
    const supplier = supplierId ? await prisma.supplier.findUnique({ where: { id: supplierId }, select: { id: true, name: true } }) : null
    if (!supplier) return NextResponse.json({ error: 'Pick the supplier.' }, { status: 400 })
    const note = typeof body.note === 'string' && body.note.trim() ? body.note.trim().slice(0, 300) : null
    const actor = await requestActor(request)

    if (body.fromWithdrawalId) {
      const w = await prisma.withdrawal.findUnique({ where: { id: String(body.fromWithdrawalId) } })
      if (!w) return NextResponse.json({ error: 'Withdrawal not found' }, { status: 404 })
      if (w.type !== 'PROFIT') return NextResponse.json({ error: 'Only a profit withdrawal can be turned into an advance.' }, { status: 400 })
      const advance = await withBalanceGuard(async (tx) => {
        await tx.withdrawal.delete({ where: { id: w.id } })
        return tx.supplierAdvance.create({
          data: {
            supplierId: supplier.id,
            personId: w.personId,
            amount: w.amount,
            date: w.createdAt,
            note: note || w.reason || null,
            createdBy: actor.name ?? null,
          },
        })
      })
      return NextResponse.json(advance, { status: 201 })
    }

    const personId = String(body.personId || '')
    const amount = r2(parseFloat(String(body.amount)))
    if (!(await prisma.person.findUnique({ where: { id: personId }, select: { id: true } }))) {
      return NextResponse.json({ error: 'Pick who gave the advance.' }, { status: 400 })
    }
    if (!(amount > 0)) return NextResponse.json({ error: 'Enter the amount given.' }, { status: 400 })
    const date = body.date ? new Date(body.date) : new Date()
    if (isNaN(date.getTime())) return NextResponse.json({ error: 'Invalid date' }, { status: 400 })
    const advance = await withBalanceGuard((tx) =>
      tx.supplierAdvance.create({ data: { supplierId: supplier.id, personId, amount, date, note, createdBy: actor.name ?? null } })
    )
    return NextResponse.json(advance, { status: 201 })
  } catch (error: any) {
    const handled = balanceErrorResponse(error) || advanceErrorResponse(error)
    if (handled) return NextResponse.json(handled, { status: 400 })
    return NextResponse.json({ error: error.message || 'Could not save the advance' }, { status: 500 })
  }
}

