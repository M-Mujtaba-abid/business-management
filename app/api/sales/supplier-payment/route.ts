import { NextRequest, NextResponse } from 'next/server'
import prisma from '@/lib/prisma'
import { logOrder, nameMaps, orderRef, ordersOf, requestActor, rs } from '@/lib/orderLog'
import { withBalanceGuard, balanceErrorResponse } from '@/lib/balanceGuard'
import { resolveSupplierPayer } from '@/lib/supplierPayer'

// Mark supplier payments Paid / Pending.
// PATCH { saleIds, status: 'PAID' | 'PENDING', paidById? }
// Paid: the cover cost leaves the payer's In hand (paidById, else the default payer — Mujtaba).
export async function PATCH(request: NextRequest) {
  try {
    const { saleIds, status, paidById } = (await request.json()) as {
      saleIds: string[]
      status: 'PAID' | 'PENDING'
      paidById?: string | null
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
    const payer = status === 'PAID' ? await resolveSupplierPayer(paidById) : null

    // Only rows that really change (a Paid row keeps its first payment date and payer)
    const changing = before.filter((s) => s.supplierPaymentStatus !== status)
    // the payer cannot go below zero
    await withBalanceGuard((tx) =>
      tx.sale.updateMany({
        where: { id: { in: changing.map((s) => s.id) } },
        data: {
          supplierPaymentStatus: status,
          supplierPaidAt: status === 'PAID' ? new Date() : null,
          supplierPaidById: payer,
        },
      })
    )

    // Order history: orders whose supplier payment really changed
    const actor = await requestActor(request)
    const names = await nameMaps()
    const payerName = payer ? names.people.get(payer) : null
    await logOrder(
      ordersOf(changing).map((rows) => {
        const cost = rows.reduce((a, s) => a + s.costPrice * s.quantity, 0)
        const supplier = Array.from(new Set(rows.map((s) => (s.supplierId ? names.suppliers.get(s.supplierId) : null)).filter(Boolean))).join(', ')
        return {
          ...orderRef(rows),
          action: 'supplier_payment',
          message: `Supplier${supplier ? ` (${supplier})` : ''}: ${
            status === 'PAID' ? `marked Paid · ${rs(cost)}${payerName ? ` · paid by ${payerName}` : ''}` : 'changed back to Pending'
          }`,
          actor,
          details: { to: status, cost, supplier, paidBy: payerName },
        }
      })
    )

    return NextResponse.json({ updated: changing.length, paidBy: payerName })
  } catch (error: any) {
    const blocked = balanceErrorResponse(error)
    if (blocked) return NextResponse.json(blocked, { status: 400 })
    return NextResponse.json({ error: error.message || 'Failed to update supplier payment' }, { status: 500 })
  }
}
