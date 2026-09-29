import { NextRequest, NextResponse } from 'next/server'
import prisma from '@/lib/prisma'

export async function PATCH(request: NextRequest) {
  try {
    const { saleIds, status } = (await request.json()) as {
      saleIds: string[]
      status: 'PAID' | 'PENDING'
    }

    if (!Array.isArray(saleIds) || saleIds.length === 0) {
      return NextResponse.json({ error: 'No orders selected' }, { status: 400 })
    }
    if (status !== 'PAID' && status !== 'PENDING') {
      return NextResponse.json({ error: 'Invalid payment status' }, { status: 400 })
    }

    // Orders with no supplier payment (old inventory orders, returned-stock orders) are left untouched
    const result = await prisma.sale.updateMany({
      where: { id: { in: saleIds }, supplierPaymentStatus: { not: 'NOT_APPLICABLE' } },
      data: {
        supplierPaymentStatus: status,
        supplierPaidAt: status === 'PAID' ? new Date() : null,
      },
    })

    return NextResponse.json({ updated: result.count })
  } catch (error: any) {
    return NextResponse.json({ error: error.message || 'Failed to update supplier payment' }, { status: 500 })
  }
}
