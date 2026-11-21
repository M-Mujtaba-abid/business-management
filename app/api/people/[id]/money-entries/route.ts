import { NextRequest, NextResponse } from 'next/server'
import prisma from '@/lib/prisma'
import { withBalanceGuard, balanceErrorResponse } from '@/lib/balanceGuard'
import { requestActor } from '@/lib/orderLog'

export const dynamic = 'force-dynamic'

const KINDS = ['OPENING', 'INVESTMENT', 'ADJUSTMENT'] as const
type Kind = (typeof KINDS)[number]

// The opening balance is dated just before the first real order, so it is the first line of the
// statement. Orders dated before 2020 are test / demo data (e.g. #1001 in 1976) and are ignored.
const REAL_ORDERS_FROM = new Date('2020-01-01T00:00:00Z')
async function firstOrderDate(): Promise<Date | null> {
  const first = await prisma.sale.findFirst({ where: { createdAt: { gte: REAL_ORDERS_FROM } }, orderBy: { createdAt: 'asc' }, select: { createdAt: true } })
  return first ? new Date(first.createdAt.getTime() - 60 * 1000) : null
}

// GET → { entries (newest first), firstOrderDate, opening (the person's opening entry or null) }
export async function GET(_request: NextRequest, { params }: { params: { id: string } }) {
  try {
    const entries = await prisma.moneyEntry.findMany({ where: { personId: params.id }, orderBy: { date: 'desc' } })
    return NextResponse.json({ entries, firstOrderDate: await firstOrderDate(), opening: entries.find((e) => e.kind === 'OPENING') || null })
  } catch (error: any) {
    return NextResponse.json({ error: error.message || 'Could not load' }, { status: 500 })
  }
}

// POST { kind, amount, date?, note? }
//  OPENING    amount > 0, once per person (sending it again replaces the old one); date defaults to
//             just before the first real order (can be set)
//  INVESTMENT amount > 0
//  ADJUSTMENT amount + or −, a reason (note) is required; cannot take anyone below zero
export async function POST(request: NextRequest, { params }: { params: { id: string } }) {
  try {
    const person = await prisma.person.findUnique({ where: { id: params.id }, select: { id: true, name: true } })
    if (!person) return NextResponse.json({ error: 'Person not found' }, { status: 404 })

    const body = await request.json().catch(() => ({}))
    const kind = body.kind as Kind
    if (!KINDS.includes(kind)) return NextResponse.json({ error: 'Pick Opening balance, Investment or Adjustment.' }, { status: 400 })
    const amount = Math.round(parseFloat(String(body.amount)) * 100) / 100
    if (!Number.isFinite(amount) || amount === 0) return NextResponse.json({ error: 'Enter the amount.' }, { status: 400 })
    if (kind !== 'ADJUSTMENT' && amount < 0) return NextResponse.json({ error: 'The amount must be more than 0.' }, { status: 400 })
    const note = typeof body.note === 'string' && body.note.trim() ? body.note.trim().slice(0, 300) : null
    if (kind === 'ADJUSTMENT' && !note) return NextResponse.json({ error: 'Write the reason for the adjustment (e.g. bank profit, bank fee).' }, { status: 400 })

    let date: Date
    if (body.date) {
      date = new Date(body.date)
      if (isNaN(date.getTime())) return NextResponse.json({ error: 'Invalid date.' }, { status: 400 })
    } else if (kind === 'OPENING') {
      date = (await firstOrderDate()) || new Date() // default: just before the first real order
    } else {
      date = new Date()
    }

    const actor = await requestActor(request)
    const entry = await withBalanceGuard(async (tx) => {
      if (kind === 'OPENING') await tx.moneyEntry.deleteMany({ where: { personId: person.id, kind: 'OPENING' } }) // one per person
      return tx.moneyEntry.create({ data: { personId: person.id, kind, amount, date, note, createdBy: actor.name ?? null } })
    })
    return NextResponse.json(entry, { status: 201 })
  } catch (error: any) {
    const blocked = balanceErrorResponse(error)
    if (blocked) return NextResponse.json(blocked, { status: 400 })
    return NextResponse.json({ error: error.message || 'Could not save' }, { status: 500 })
  }
}
