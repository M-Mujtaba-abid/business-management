import { NextRequest, NextResponse } from 'next/server'
import prisma from '@/lib/prisma'

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

    // Old orders created before payment tracking are left untouched
    const result = await prisma.sale.updateMany({
      where: { id: { in: saleIds }, paymentStatus: { not: 'NOT_APPLICABLE' } },
      data,
    })

    return NextResponse.json({ updated: result.count })
  } catch (error: any) {
    return NextResponse.json({ error: error.message || 'Failed to update payment' }, { status: 500 })
  }
}
