import { NextResponse } from 'next/server'
import prisma from '@/lib/prisma'

export const dynamic = 'force-dynamic'

// Per-supplier payable computed from orders: what we still owe for covers bought on credit
export async function GET() {
  try {
    const [suppliers, pendingSales] = await Promise.all([
      prisma.supplier.findMany({ orderBy: { name: 'asc' } }),
      prisma.sale.findMany({
        where: { supplierPaymentStatus: 'PENDING', supplierId: { not: null } },
        select: { id: true, supplierId: true, costPrice: true, quantity: true, createdAt: true },
      }),
    ])

    const summary = suppliers.map((sup) => {
      const own = pendingSales.filter((s) => s.supplierId === sup.id)
      const oldest = own.reduce<Date | null>(
        (min, s) => (!min || s.createdAt < min ? s.createdAt : min),
        null
      )
      return {
        id: sup.id,
        name: sup.name,
        phone: sup.phone,
        pendingAmount: own.reduce((acc, s) => acc + s.costPrice * s.quantity, 0),
        pendingCount: own.length,
        pendingSaleIds: own.map((s) => s.id),
        oldestPendingAt: oldest,
      }
    })

    return NextResponse.json(summary)
  } catch (error: any) {
    return NextResponse.json({ error: error.message || 'Failed to fetch supplier summary' }, { status: 500 })
  }
}
