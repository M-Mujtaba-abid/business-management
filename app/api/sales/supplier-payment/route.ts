import { NextRequest, NextResponse } from 'next/server'
import prisma from '@/lib/prisma'
import { logOrder, nameMaps, orderRef, ordersOf, requestActor, rs } from '@/lib/orderLog'

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
    const where = { id: { in: saleIds }, supplierPaymentStatus: { not: 'NOT_APPLICABLE' as const } }
    const before = await prisma.sale.findMany({ where })
    const result = await prisma.sale.updateMany({
      where,
      data: {
        supplierPaymentStatus: status,
        supplierPaidAt: status === 'PAID' ? new Date() : null,
      },
    })

    // Order history: orders whose supplier payment really changed
    const actor = await requestActor(request)
    const names = await nameMaps()
    await logOrder(
      ordersOf(before.filter((s) => s.supplierPaymentStatus !== status)).map((rows) => {
        const cost = rows.reduce((a, s) => a + s.costPrice * s.quantity, 0)
        const supplier = Array.from(new Set(rows.map((s) => (s.supplierId ? names.suppliers.get(s.supplierId) : null)).filter(Boolean))).join(', ')
        return {
          ...orderRef(rows),
          action: 'supplier_payment',
          message: `Supplier${supplier ? ` (${supplier})` : ''}: ${status === 'PAID' ? `marked Paid · ${rs(cost)}` : 'changed back to Pending'}`,
          actor,
          details: { to: status, cost, supplier },
        }
      })
    )

    return NextResponse.json({ updated: result.count })
  } catch (error: any) {
    return NextResponse.json({ error: error.message || 'Failed to update supplier payment' }, { status: 500 })
  }
}
