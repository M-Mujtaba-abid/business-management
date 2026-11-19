import { NextRequest, NextResponse } from 'next/server'
import prisma from '@/lib/prisma'
import { withBalanceGuard, balanceErrorResponse } from '@/lib/balanceGuard'
import { deliveredProfit, payoutAmount, saleTotal, splitByWeight } from '@/lib/saleMoney'
import { logOrder, orderRef, requestActor, rs } from '@/lib/orderLog'

// Set the actual amount received for one order (and optionally mark it Received / Not received).
// For a parcel the amount is the whole parcel's payout, split across its products by sale value.
// A delivered order's profit is recalculated so tax / fee cuts show up in profit.
export async function PATCH(
  request: NextRequest,
  { params }: { params: { id: string } }
) {
  try {
    const body = (await request.json()) as {
      receivedAmount?: number | string | null
      status?: 'RECEIVED' | 'NOT_RECEIVED'
    }

    const sale = await prisma.sale.findUnique({ where: { id: params.id } })
    if (!sale) {
      return NextResponse.json({ error: 'Order not found' }, { status: 404 })
    }
    if (sale.paymentStatus === 'NOT_APPLICABLE') {
      return NextResponse.json({ error: 'Payment tracking is off for this older order' }, { status: 400 })
    }
    const sales = sale.parcelId
      ? await prisma.sale.findMany({ where: { parcelId: sale.parcelId }, orderBy: { createdAt: 'asc' } })
      : [sale]

    // Payout per product (undefined = leave unchanged)
    let payouts: (number | null)[] | undefined
    if ('receivedAmount' in body) {
      if (body.receivedAmount === null || body.receivedAmount === '') {
        payouts = sales.map(() => null)
      } else {
        const amt = parseFloat(String(body.receivedAmount))
        if (isNaN(amt) || amt < 0) {
          return NextResponse.json({ error: 'Enter a valid amount' }, { status: 400 })
        }
        const shares = splitByWeight(amt, sales.map(saleTotal))
        // Same as the sale total means "no cut": store null so it follows future price edits
        payouts = sales.map((s, i) => (Math.abs(shares[i] - saleTotal(s)) < 0.005 ? null : shares[i]))
      }
    }

    if (body.status !== undefined && body.status !== 'RECEIVED' && body.status !== 'NOT_RECEIVED') {
      return NextResponse.json({ error: 'Invalid payment status' }, { status: 400 })
    }

    // Lowering the received amount or undoing "Received" cannot leave the person below zero
    const updated = await withBalanceGuard(async (tx) => {
      const rows = []
      for (const [i, s] of sales.entries()) {
        const data: { receivedAmount?: number | null; paymentStatus?: 'RECEIVED' | 'NOT_RECEIVED'; paymentReceivedAt?: Date | null; profit?: number } = {}
        if (payouts) {
          data.receivedAmount = payouts[i]
          if (s.status === 'DELIVERED') data.profit = deliveredProfit({ ...s, receivedAmount: payouts[i] })
        }
        if (body.status !== undefined) {
          data.paymentStatus = body.status
          data.paymentReceivedAt = body.status === 'RECEIVED' ? s.paymentReceivedAt ?? new Date() : null
        }
        rows.push(await tx.sale.update({ where: { id: s.id }, data }))
      }
      return rows
    })

    // Order history
    {
      const actor = await requestActor(request)
      const oldAmount = sales.reduce((a, s) => a + payoutAmount(s), 0)
      const newAmount = updated.reduce((a, s) => a + payoutAmount(s), 0)
      const parts: string[] = []
      if (Math.abs(oldAmount - newAmount) >= 0.5) parts.push(`Amount received: ${rs(oldAmount)} → ${rs(newAmount)}`)
      if (body.status && body.status !== sales[0].paymentStatus) {
        parts.push(body.status === 'RECEIVED' ? `Payment marked Received (${rs(newAmount)})` : 'Payment changed back to Not received')
      }
      if (parts.length) {
        await logOrder({
          ...orderRef(sales),
          action: 'payment',
          message: parts.join(' · '),
          actor,
          details: { amountFrom: oldAmount, amountTo: newAmount, statusFrom: sales[0].paymentStatus, statusTo: body.status ?? sales[0].paymentStatus },
        })
      }
    }

    return NextResponse.json(updated.find((s) => s.id === params.id) ?? updated[0])
  } catch (error: any) {
    const blocked = balanceErrorResponse(error)
    if (blocked) return NextResponse.json(blocked, { status: 400 })
    return NextResponse.json({ error: error.message || 'Failed to update payment' }, { status: 500 })
  }
}
