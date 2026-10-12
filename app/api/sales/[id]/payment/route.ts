import { NextRequest, NextResponse } from 'next/server'
import prisma from '@/lib/prisma'
import { deliveredProfit, saleTotal, splitByWeight } from '@/lib/saleMoney'

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

    const updated = await prisma.$transaction(
      sales.map((s, i) => {
        const data: { receivedAmount?: number | null; paymentStatus?: 'RECEIVED' | 'NOT_RECEIVED'; paymentReceivedAt?: Date | null; profit?: number } = {}
        if (payouts) {
          data.receivedAmount = payouts[i]
          if (s.status === 'DELIVERED') data.profit = deliveredProfit({ ...s, receivedAmount: payouts[i] })
        }
        if (body.status !== undefined) {
          data.paymentStatus = body.status
          data.paymentReceivedAt = body.status === 'RECEIVED' ? s.paymentReceivedAt ?? new Date() : null
        }
        return prisma.sale.update({ where: { id: s.id }, data })
      })
    )

    return NextResponse.json(updated.find((s) => s.id === params.id) ?? updated[0])
  } catch (error: any) {
    return NextResponse.json({ error: error.message || 'Failed to update payment' }, { status: 500 })
  }
}
