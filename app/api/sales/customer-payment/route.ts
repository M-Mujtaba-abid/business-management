import { NextRequest, NextResponse } from 'next/server'
import prisma from '@/lib/prisma'
import { withBalanceGuard, balanceErrorResponse } from '@/lib/balanceGuard'
import { LogEntry, logOrder, nameMaps, orderRef, ordersOf, requestActor, rs } from '@/lib/orderLog'
import { payoutAmount } from '@/lib/saleMoney'

// Mark money from Daraz / courier / other as received (or undo it),
// and/or change whose account the money goes to
export async function PATCH(request: NextRequest) {
  try {
    const body = (await request.json()) as {
      saleIds: string[]
      status?: 'RECEIVED' | 'NOT_RECEIVED'
      receivedById?: string | null
    }
    const { saleIds, status } = body
    const setPerson = 'receivedById' in body

    if (!Array.isArray(saleIds) || saleIds.length === 0) {
      return NextResponse.json({ error: 'No orders selected' }, { status: 400 })
    }
    if (status !== undefined && status !== 'RECEIVED' && status !== 'NOT_RECEIVED') {
      return NextResponse.json({ error: 'Invalid payment status' }, { status: 400 })
    }
    if (status === undefined && !setPerson) {
      return NextResponse.json({ error: 'Nothing to update' }, { status: 400 })
    }

    const data: { paymentStatus?: 'RECEIVED' | 'NOT_RECEIVED'; paymentReceivedAt?: Date | null; receivedById?: string | null } = {}
    if (status !== undefined) {
      data.paymentStatus = status
      data.paymentReceivedAt = status === 'RECEIVED' ? new Date() : null
    }
    if (setPerson) data.receivedById = body.receivedById || null

    // Before values, for the order history
    const where = { id: { in: saleIds }, paymentStatus: { not: 'NOT_APPLICABLE' as const } }
    const before = await prisma.sale.findMany({ where })

    // Old orders created before payment tracking are left untouched
    // Moving money away from a person (Noman -> Mujtaba, or "Not received") cannot leave them below zero
    const result = await withBalanceGuard((tx) => tx.sale.updateMany({ where, data }))

    // Order history: one line per order that really changed
    const actor = await requestActor(request)
    const names = await nameMaps()
    const who = (id: string | null) => (id ? names.people.get(id) || 'someone' : 'no one')
    const entries: LogEntry[] = []
    for (const rows of ordersOf(before)) {
      const lead = rows[0]
      const amount = rows.reduce((a, s) => a + payoutAmount(s), 0)
      if (status && lead.paymentStatus !== status) {
        const to = setPerson ? data.receivedById ?? null : lead.receivedById
        entries.push({
          ...orderRef(rows),
          action: 'payment',
          message:
            status === 'RECEIVED'
              ? `Payment marked Received · ${rs(amount)} → ${who(to)}`
              : `Payment changed back to Not received (was Received · ${rs(amount)})`,
          actor,
          details: { from: lead.paymentStatus, to: status, amount, receivedBy: who(to) },
        })
      }
      if (setPerson && (lead.receivedById ?? null) !== (data.receivedById ?? null)) {
        entries.push({
          ...orderRef(rows),
          action: 'received_by',
          message: `Money goes to: ${who(lead.receivedById)} → ${who(data.receivedById ?? null)}`,
          actor,
          details: { from: who(lead.receivedById), to: who(data.receivedById ?? null), amount },
        })
      }
    }
    await logOrder(entries)

    return NextResponse.json({ updated: result.count })
  } catch (error: any) {
    const blocked = balanceErrorResponse(error)
    if (blocked) return NextResponse.json(blocked, { status: 400 })
    return NextResponse.json({ error: error.message || 'Failed to update payment' }, { status: 500 })
  }
}
