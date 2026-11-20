import { NextRequest, NextResponse } from 'next/server'
import prisma from '@/lib/prisma'
import { buildLedger, sumLedger } from '@/lib/personLedger'
import { requestActor } from '@/lib/orderLog'

export const dynamic = 'force-dynamic'

// Within this many rupees counts as matched (paisa rounding)
const MATCH = 1

// Statement lines since the last check that matched (what to look through when it doesn't match)
async function sinceLastMatch(personId: string, checks: { createdAt: Date; difference: number }[]) {
  const lastOk = checks.find((c) => Math.abs(c.difference) < MATCH)
  const all = (await buildLedger(prisma, personId)).get(personId) || []
  const inHand = sumLedger(all)
  const after = lastOk ? all.filter((e) => e.date > lastOk.createdAt) : all.slice(-40)
  let balance = sumLedger(all.slice(0, all.length - after.length))
  const entries = after.map((e) => {
    balance = Math.round((balance + e.amount) * 100) / 100
    return { ...e, balance }
  })
  return { inHand, lastMatchedAt: lastOk?.createdAt ?? null, entries: entries.reverse() }
}

// GET → { inHand, bankName (last used), checks (newest first), lastMatchedAt, entries since then }
export async function GET(_request: NextRequest, { params }: { params: { id: string } }) {
  try {
    const person = await prisma.person.findUnique({ where: { id: params.id }, select: { id: true, name: true } })
    if (!person) return NextResponse.json({ error: 'Person not found' }, { status: 404 })
    const checks = await prisma.bankCheck.findMany({ where: { personId: person.id }, orderBy: { createdAt: 'desc' }, take: 50 })
    const since = await sinceLastMatch(person.id, checks)
    return NextResponse.json({ person, bankName: checks[0]?.bankName || '', checks, ...since })
  } catch (error: any) {
    return NextResponse.json({ error: error.message || 'Could not load bank checks' }, { status: 500 })
  }
}

// POST { bankBalance, bankName, note? } → saves the check against the app's In hand right now
export async function POST(request: NextRequest, { params }: { params: { id: string } }) {
  try {
    const body = await request.json().catch(() => ({}))
    const bankBalance = parseFloat(String(body.bankBalance))
    const bankName = typeof body.bankName === 'string' ? body.bankName.trim() : ''
    if (!Number.isFinite(bankBalance)) return NextResponse.json({ error: 'Enter the balance shown in the bank app.' }, { status: 400 })
    if (!bankName) return NextResponse.json({ error: 'Enter the bank name (e.g. Meezan).' }, { status: 400 })

    const person = await prisma.person.findUnique({ where: { id: params.id }, select: { id: true, name: true } })
    if (!person) return NextResponse.json({ error: 'Person not found' }, { status: 404 })

    const all = (await buildLedger(prisma, person.id)).get(person.id) || []
    const inHand = sumLedger(all)
    const difference = Math.round((bankBalance - inHand) * 100) / 100
    const actor = await requestActor(request)
    const check = await prisma.bankCheck.create({
      data: {
        personId: person.id,
        bankName,
        bankBalance,
        inHand,
        difference,
        note: typeof body.note === 'string' && body.note.trim() ? body.note.trim() : null,
        createdBy: actor.name ?? null,
      },
    })
    const checks = await prisma.bankCheck.findMany({ where: { personId: person.id }, orderBy: { createdAt: 'desc' }, take: 50 })
    // "since last match" must look at the checks before this one
    const since = await sinceLastMatch(person.id, checks.filter((c) => c.id !== check.id))
    return NextResponse.json({ check, matched: Math.abs(difference) < MATCH, checks, ...since }, { status: 201 })
  } catch (error: any) {
    return NextResponse.json({ error: error.message || 'Could not save the bank check' }, { status: 500 })
  }
}
