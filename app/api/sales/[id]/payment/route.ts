import { NextRequest, NextResponse } from 'next/server'
import prisma from '@/lib/prisma'
import { deliveredProfit, saleTotal } from '@/lib/saleMoney'

// Set the actual amount received for one order (and optionally mark it Received / Not received).
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

    const data: { receivedAmount?: number | null; paymentStatus?: 'RECEIVED' | 'NOT_RECEIVED'; paymentReceivedAt?: Date | null; profit?: number } = {}

    if ('receivedAmount' in body) {
      if (body.receivedAmount === null || body.receivedAmount === '') {
        data.receivedAmount = null
      } else {
        const amt = parseFloat(String(body.receivedAmount))
        if (isNaN(amt) || amt < 0) {
          return NextResponse.json({ error: 'Enter a valid amount' }, { status: 400 })
        }
        // Same as the sale total means "no cut": store null so it follows future price edits
        data.receivedAmount = Math.abs(amt - saleTotal(sale)) < 0.005 ? null : amt
      }
    }

    if (body.status !== undefined) {
      if (body.status !== 'RECEIVED' && body.status !== 'NOT_RECEIVED') {
        return NextResponse.json({ error: 'Invalid payment status' }, { status: 400 })
      }
      data.paymentStatus = body.status
      data.paymentReceivedAt = body.status === 'RECEIVED' ? sale.paymentReceivedAt ?? new Date() : null
    }

    if (sale.status === 'DELIVERED' && 'receivedAmount' in data) {
      data.profit = deliveredProfit({ ...sale, receivedAmount: data.receivedAmount ?? null })
    }

    const updated = await prisma.sale.update({ where: { id: params.id }, data })
    return NextResponse.json(updated)
  } catch (error: any) {
    return NextResponse.json({ error: error.message || 'Failed to update payment' }, { status: 500 })
  }
}
