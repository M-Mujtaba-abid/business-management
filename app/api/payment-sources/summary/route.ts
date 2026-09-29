import { NextResponse } from 'next/server'
import prisma from '@/lib/prisma'

export const dynamic = 'force-dynamic'

// Per-source receivable: money for delivered orders that has not reached us yet
export async function GET() {
  try {
    const [sources, pendingSales] = await Promise.all([
      prisma.paymentSource.findMany({ orderBy: { name: 'asc' } }),
      prisma.sale.findMany({
        where: { paymentStatus: 'NOT_RECEIVED', status: 'DELIVERED' },
        select: { id: true, paymentSourceId: true, soldPrice: true, quantity: true, createdAt: true },
      }),
    ])

    const build = (id: string | null, name: string) => {
      const own = pendingSales.filter((s) => s.paymentSourceId === id)
      const oldest = own.reduce<Date | null>(
        (min, s) => (!min || s.createdAt < min ? s.createdAt : min),
        null
      )
      return {
        id,
        name,
        pendingAmount: own.reduce((acc, s) => acc + s.soldPrice * s.quantity, 0),
        pendingCount: own.length,
        pendingSaleIds: own.map((s) => s.id),
        oldestPendingAt: oldest,
      }
    }

    const summary = sources.map((src) => build(src.id, src.name))

    // Delivered orders saved without a source still need their money tracked
    const unassigned = build(null, 'No source set')
    if (unassigned.pendingCount > 0) summary.push(unassigned)

    return NextResponse.json(summary)
  } catch (error: any) {
    return NextResponse.json({ error: error.message || 'Failed to fetch payment summary' }, { status: 500 })
  }
}
