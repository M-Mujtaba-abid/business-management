import { NextRequest, NextResponse } from 'next/server'
import prisma from '@/lib/prisma'
import { withBalanceGuard, balanceErrorResponse } from '@/lib/balanceGuard'
import { defaultSupplierPayer, setDefaultSupplierPayer } from '@/lib/supplierPayer'
import { coverOwed } from '@/lib/personLedger'
import { logOrder, ordersOf, orderRef, requestActor, rs } from '@/lib/orderLog'

export const dynamic = 'force-dynamic'

// Older supplier payments: marked Paid before "who paid" was recorded
const LEGACY = { supplierPaymentStatus: 'PAID' as const, supplierPaidById: null, inventoryItemId: null }

// GET → { defaultPayerId, people, legacy: { orders, cover, byReceiver: [{ name, orders, cover }] } }
export async function GET() {
  try {
    const [defaultPayerId, people, rows] = await Promise.all([
      defaultSupplierPayer(),
      prisma.person.findMany({ orderBy: { name: 'asc' }, select: { id: true, name: true } }),
      prisma.sale.findMany({
        where: LEGACY,
        select: { id: true, orderNo: true, parcelId: true, costPrice: true, quantity: true, supplierPaymentStatus: true, inventoryItemId: true, receivedById: true, paymentStatus: true },
      }),
    ])
    const name = new Map(people.map((p) => [p.id, p.name]))
    const byReceiver = new Map<string, { name: string; orders: Set<string>; cover: number }>()
    for (const r of rows) {
      const key = r.paymentStatus === 'RECEIVED' && r.receivedById ? name.get(r.receivedById) || '?' : 'not received yet'
      const e = byReceiver.get(key) || { name: key, orders: new Set<string>(), cover: 0 }
      e.orders.add(r.orderNo != null ? `#${r.orderNo}` : r.parcelId || r.id)
      e.cover += coverOwed(r)
      byReceiver.set(key, e)
    }
    return NextResponse.json({
      defaultPayerId,
      people,
      legacy: {
        orders: new Set(rows.map((r) => (r.orderNo != null ? `#${r.orderNo}` : r.parcelId || r.id))).size,
        cover: Math.round(rows.reduce((a, r) => a + coverOwed(r), 0)),
        byReceiver: Array.from(byReceiver.values()).map((e) => ({ name: e.name, orders: e.orders.size, cover: Math.round(e.cover) })),
      },
    })
  } catch (error: any) {
    return NextResponse.json({ error: error.message || 'Could not load' }, { status: 500 })
  }
}

// PUT { defaultPayerId } → who pays suppliers by default
export async function PUT(request: NextRequest) {
  try {
    const { defaultPayerId } = await request.json().catch(() => ({}))
    const p = defaultPayerId ? await prisma.person.findUnique({ where: { id: String(defaultPayerId) } }) : null
    if (!p) return NextResponse.json({ error: 'Pick a person' }, { status: 400 })
    await setDefaultSupplierPayer(p.id)
    return NextResponse.json({ defaultPayerId: p.id })
  } catch (error: any) {
    return NextResponse.json({ error: error.message || 'Could not save' }, { status: 500 })
  }
}

// POST { personId } → one time: record this person as the payer of every older supplier payment
export async function POST(request: NextRequest) {
  try {
    const { personId } = await request.json().catch(() => ({}))
    const person = personId ? await prisma.person.findUnique({ where: { id: String(personId) }, select: { id: true, name: true } }) : null
    if (!person) return NextResponse.json({ error: 'Pick who paid the suppliers' }, { status: 400 })

    const rows = await prisma.sale.findMany({ where: LEGACY })
    if (!rows.length) return NextResponse.json({ updated: 0 })
    // the payer cannot go below zero
    await withBalanceGuard((tx) => tx.sale.updateMany({ where: { id: { in: rows.map((r) => r.id) } }, data: { supplierPaidById: person.id } }))

    const actor = await requestActor(request)
    await logOrder(
      ordersOf(rows).map((g) => ({
        ...orderRef(g),
        action: 'supplier_payment',
        message: `Supplier payment (paid earlier) recorded as paid by ${person.name} · ${rs(g.reduce((a, s) => a + coverOwed(s), 0))}`,
        actor,
        details: { paidBy: person.name, backfill: true },
      }))
    )
    return NextResponse.json({ updated: rows.length, orders: ordersOf(rows).length })
  } catch (error: any) {
    const blocked = balanceErrorResponse(error)
    if (blocked) return NextResponse.json(blocked, { status: 400 })
    return NextResponse.json({ error: error.message || 'Could not save' }, { status: 500 })
  }
}
