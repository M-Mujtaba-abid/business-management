import { NextRequest, NextResponse } from 'next/server'
import prisma from '@/lib/prisma'
import { buildLedger, coverOwed, splitInHand } from '@/lib/personLedger'

export const dynamic = 'force-dynamic'

const r2 = (n: number) => Math.round(n * 100) / 100

// What makes up a person's "Supplier money" and "Own money" (Payments card → click a box).
// GET → {
//   supplier: { total, lines: [{ group, orderNo, customer, supplier, amount, date, note }] }
//     group: 'unpaid'   received by this person, supplier not paid yet          (+ cover: pay the supplier)
//                       covered: how much of it is in hand now (green); the rest was already used
//            'payback'  received by this person, supplier paid by someone else  (+ cover: send it to the payer)
//            'advance'  supplier paid by this person, order money not with them  (− cover: comes back later)
//            'transfer' supplier money moved with a transfer                     (±)
//   own: { total, lines: [{ date, kind, title, detail, amount }] }   newest first
// }
export async function GET(_request: NextRequest, { params }: { params: { id: string } }) {
  try {
    const person = await prisma.person.findUnique({ where: { id: params.id }, select: { id: true, name: true } })
    if (!person) return NextResponse.json({ error: 'Person not found' }, { status: 404 })
    const people = new Map((await prisma.person.findMany({ select: { id: true, name: true } })).map((p) => [p.id, p.name]))

    const select = {
      id: true,
      orderNo: true,
      parcelId: true,
      customerName: true,
      costPrice: true,
      quantity: true,
      inventoryItemId: true,
      supplierPaymentStatus: true,
      supplierPaidById: true,
      supplierPaidAt: true,
      paymentReceivedAt: true,
      receivedById: true,
      paymentStatus: true,
      status: true,
      createdAt: true,
      supplier: { select: { name: true } },
    } as const
    const [mineReceived, paidByMe, transfers, ledger] = await Promise.all([
      // order money with this person, supplier unpaid or paid by someone else
      prisma.sale.findMany({
        where: {
          paymentStatus: 'RECEIVED',
          receivedById: person.id,
          OR: [{ supplierPaymentStatus: 'PENDING' }, { supplierPaymentStatus: 'PAID', supplierPaidById: { not: null, notIn: [person.id] } }],
        },
        select,
      }),
      // suppliers this person paid where the order money is not with them (not received yet, or with someone else)
      prisma.sale.findMany({
        where: {
          supplierPaymentStatus: 'PAID',
          supplierPaidById: person.id,
          status: { notIn: ['CANCELLED', 'RETURNED'] },
          OR: [{ paymentStatus: { not: 'RECEIVED' } }, { receivedById: { not: person.id } }, { receivedById: null }],
        },
        select,
      }),
      prisma.moneyTransfer.findMany({
        where: { OR: [{ fromId: person.id }, { toId: person.id }], supplierPart: { not: 0 } },
        orderBy: { date: 'desc' },
      }),
      buildLedger(prisma, person.id),
    ])

    type Line = { group: string; orderNo: number | null; customer: string; supplier: string; amount: number; date: Date | null; note: string }
    type SupplierLineKey = Line
    const lines: Line[] = []
    // one line per order (a parcel's products together)
    const add = (rows: typeof mineReceived, group: string, sign: 1 | -1, note: (s: (typeof mineReceived)[number]) => string) => {
      const byOrder = new Map<string, typeof mineReceived>()
      for (const s of rows) {
        if (!coverOwed(s)) continue
        const k = s.orderNo != null ? `#${s.orderNo}` : s.parcelId || s.id
        byOrder.set(k, [...(byOrder.get(k) || []), s])
      }
      for (const g of Array.from(byOrder.values())) {
        lines.push({
          group,
          orderNo: g[0].orderNo,
          customer: g[0].customerName,
          supplier: Array.from(new Set(g.map((s) => s.supplier?.name).filter(Boolean))).join(', ') || '—',
          amount: r2(sign * g.reduce((a, s) => a + coverOwed(s), 0)),
          date: g[0].paymentReceivedAt || g[0].supplierPaidAt || g[0].createdAt,
          note: note(g[0]),
        })
      }
    }
    add(mineReceived.filter((s) => s.supplierPaymentStatus === 'PENDING'), 'unpaid', 1, () => 'supplier not paid yet')
    add(
      mineReceived.filter((s) => s.supplierPaymentStatus === 'PAID'),
      'payback',
      1,
      (s) => `supplier paid by ${people.get(s.supplierPaidById as string) || '?'} — send it to them`
    )
    add(paidByMe, 'advance', -1, (s) =>
      s.paymentStatus === 'RECEIVED' && s.receivedById ? `order money is with ${people.get(s.receivedById) || '?'}` : 'order money not received yet'
    )
    for (const t of transfers) {
      const out = t.fromId === person.id
      lines.push({
        group: 'transfer',
        orderNo: null,
        customer: out ? `Sent to ${people.get(t.toId)}` : `Received from ${people.get(t.fromId)}`,
        supplier: '',
        amount: r2(out ? -t.supplierPart : t.supplierPart),
        date: t.date,
        note: `supplier money inside the Rs. ${Math.round(t.amount).toLocaleString('en-PK')} transfer`,
      })
    }

    const entries = ledger.get(person.id) || []
    const split = splitInHand(entries)
    const listed = r2(lines.reduce((a, l) => a + l.amount, 0))

    // Which unpaid suppliers the supplier money actually in hand covers (oldest order money first).
    // covered = the part of this order's cover cost that is in hand now; the rest was already used
    // (e.g. for suppliers paid in advance) and will have to come from own money.
    let available = Math.max(0, split.supplier)
    const unpaidOldestFirst = lines.filter((l) => l.group === 'unpaid').sort((a, b) => (a.date?.getTime() || 0) - (b.date?.getTime() || 0))
    const coveredOf = new Map<SupplierLineKey, number>()
    for (const l of unpaidOldestFirst) {
      const c = r2(Math.min(l.amount, available))
      coveredOf.set(l, c)
      available = r2(available - c)
    }
    for (const l of lines) (l as any).covered = l.group === 'unpaid' ? coveredOf.get(l) ?? 0 : null

    // Own money: every line's own part (its amount minus its supplier part), newest first
    const own = entries
      .map((e) => ({ date: e.date, kind: e.kind, title: e.title, detail: e.detail, amount: r2(e.amount - (e.supplier || 0)) }))
      .filter((e) => Math.abs(e.amount) >= 0.5)
      .reverse()

    return NextResponse.json({
      person,
      inHand: split.inHand,
      supplier: { total: split.supplier, listed, lines: lines.sort((a, b) => (b.date?.getTime() || 0) - (a.date?.getTime() || 0)) },
      own: { total: split.own, lines: own },
    })
  } catch (error: any) {
    return NextResponse.json({ error: error.message || 'Could not load' }, { status: 500 })
  }
}
