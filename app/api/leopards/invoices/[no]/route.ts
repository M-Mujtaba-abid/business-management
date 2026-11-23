import { NextRequest, NextResponse } from 'next/server'
import prisma from '@/lib/prisma'
import { withBalanceGuard, balanceErrorResponse } from '@/lib/balanceGuard'
import { settleLeopardsMoney } from '@/lib/leopardsMoney'
import { LogEntry, logOrder, ordersOf, orderRef, requestActor, rs } from '@/lib/orderLog'
import { payoutAmount } from '@/lib/saleMoney'

export const dynamic = 'force-dynamic'

// "Money received" on a Leopards invoice (or undo it):
//   PATCH { received: true, receivedById, date?: 'YYYY-MM-DD' } → invoice received; its orders marked Received
//   PATCH { received: false }                                   → back to not received; its orders back to Not received
export async function PATCH(request: NextRequest, { params }: { params: { no: string } }) {
  try {
    const invoiceNo = decodeURIComponent(params.no)
    const body = (await request.json()) as { received?: boolean; receivedById?: string | null; date?: string }
    const inv = await prisma.leopardsInvoice.findUnique({ where: { invoiceNo } })
    if (!inv) return NextResponse.json({ error: 'Invoice not found' }, { status: 404 })
    const actor = await requestActor(request)

    if (body.received) {
      if (!body.receivedById) return NextResponse.json({ error: 'Choose whose account the money came to' }, { status: 400 })
      const person = await prisma.person.findUnique({ where: { id: body.receivedById } })
      if (!person) return NextResponse.json({ error: 'Person not found' }, { status: 400 })
      let at = new Date()
      if (body.date) {
        const d = new Date(`${body.date}T12:00:00+05:00`)
        if (isNaN(d.getTime())) return NextResponse.json({ error: 'Invalid date' }, { status: 400 })
        at = d
      }
      await prisma.leopardsInvoice.update({
        where: { invoiceNo },
        data: { receivedAt: at, receivedById: person.id, markedBy: actor.name || null },
      })
      // Orders it paid → Received (with the real money), money in the person's In hand
      const settled = await settleLeopardsMoney()
      return NextResponse.json({ ok: true, paid: settled.paid })
    }

    // Undo: the invoice and the orders it marked Received (cannot leave anyone below zero)
    const rows = await prisma.sale.findMany({ where: { courierInvoiceNo: invoiceNo, paymentStatus: 'RECEIVED', courierMoneyAuto: true } })
    await withBalanceGuard(async (tx) => {
      await tx.leopardsInvoice.update({ where: { invoiceNo }, data: { receivedAt: null, markedBy: null } })
      if (rows.length) {
        await tx.sale.updateMany({
          where: { id: { in: rows.map((r) => r.id) } },
          data: { paymentStatus: 'NOT_RECEIVED', paymentReceivedAt: null },
        })
      }
    })
    await settleLeopardsMoney()
    const entries: LogEntry[] = ordersOf(rows).map((list) => ({
      ...orderRef(list),
      action: 'payment',
      message: `Leopards invoice ${invoiceNo} set back to not received · payment back to Not received (was ${rs(list.reduce((a, s) => a + payoutAmount(s), 0))})`,
      actor,
      details: { invoiceNo, from: 'RECEIVED', to: 'NOT_RECEIVED' },
    }))
    await logOrder(entries)
    return NextResponse.json({ ok: true })
  } catch (error: any) {
    const blocked = balanceErrorResponse(error)
    if (blocked) return NextResponse.json(blocked, { status: 400 })
    return NextResponse.json({ error: error.message || 'Failed to update the invoice' }, { status: 500 })
  }
}
