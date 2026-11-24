import { NextRequest, NextResponse } from 'next/server'
import prisma from '@/lib/prisma'
import { withBalanceGuard, balanceErrorResponse } from '@/lib/balanceGuard'
import { buildLedger, splitInHand } from '@/lib/personLedger'
import { requestActor } from '@/lib/orderLog'

export const dynamic = 'force-dynamic'

// GET → latest transfers
export async function GET() {
  try {
    const list = await prisma.moneyTransfer.findMany({
      orderBy: { date: 'desc' },
      take: 100,
      include: { from: { select: { name: true } }, to: { select: { name: true } } },
    })
    return NextResponse.json(list)
  } catch (error: any) {
    return NextResponse.json({ error: error.message || 'Could not load transfers' }, { status: 500 })
  }
}

// Send money from one person to another (a bank transfer, e.g. Meezan → Mashreq).
// POST { fromId, toId, amount, date?, note? }
// The supplier money inside it moves first (up to what the sender holds), so each person's
// "supplier money / own money" split stays right.
export async function POST(request: NextRequest) {
  try {
    const body = await request.json().catch(() => ({}))
    const fromId = String(body.fromId || '')
    const toId = String(body.toId || '')
    const amount = Math.round(parseFloat(String(body.amount)) * 100) / 100
    if (!fromId || !toId || fromId === toId) return NextResponse.json({ error: 'Pick who sent and who received.' }, { status: 400 })
    if (!(amount > 0)) return NextResponse.json({ error: 'Enter the amount sent.' }, { status: 400 })
    const [from, to] = await Promise.all([
      prisma.person.findUnique({ where: { id: fromId }, select: { id: true, name: true } }),
      prisma.person.findUnique({ where: { id: toId }, select: { id: true, name: true } }),
    ])
    if (!from || !to) return NextResponse.json({ error: 'Person not found' }, { status: 404 })
    const date = body.date ? new Date(body.date) : new Date()
    if (isNaN(date.getTime())) return NextResponse.json({ error: 'Invalid date' }, { status: 400 })

    const actor = await requestActor(request)
    const transfer = await withBalanceGuard(async (tx) => {
      const split = splitInHand((await buildLedger(tx, from.id)).get(from.id) || [])
      const supplierPart = Math.round(Math.min(amount, Math.max(0, split.supplier)) * 100) / 100
      return tx.moneyTransfer.create({
        data: {
          fromId: from.id,
          toId: to.id,
          amount,
          supplierPart,
          date,
          note: typeof body.note === 'string' && body.note.trim() ? body.note.trim().slice(0, 300) : null,
          createdBy: actor.name ?? null,
        },
      })
    })
    return NextResponse.json(transfer, { status: 201 })
  } catch (error: any) {
    const blocked = balanceErrorResponse(error)
    if (blocked) return NextResponse.json(blocked, { status: 400 })
    return NextResponse.json({ error: error.message || 'Could not save the transfer' }, { status: 500 })
  }
}
