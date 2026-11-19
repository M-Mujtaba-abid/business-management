import { NextRequest, NextResponse } from 'next/server'
import prisma from '@/lib/prisma'
import { salesWhere } from '@/lib/salesFilters'
import { countOrders } from '@/lib/saleMoney'

export const dynamic = 'force-dynamic'

const STATUSES = ['PACKING', 'DISPATCHED', 'DELIVERED', 'RETURNED', 'CANCELLED'] as const

// How many orders each status tab holds, with all the other filters of the orders list applied
// (same query string as GET /api/sales). A parcel with several products counts as one order.
export async function GET(request: NextRequest) {
  try {
    const { searchParams } = new URL(request.url)
    const rows = await prisma.sale.findMany({
      where: salesWhere(searchParams, { ignoreStatus: true }),
      select: { id: true, parcelId: true, status: true, reviewStatus: true },
    })
    const counts: Record<string, number> = { ALL: countOrders(rows) }
    for (const s of STATUSES) counts[s] = countOrders(rows.filter((r) => r.status === s))
    // "Reviews" tab: delivered, review not got yet
    counts.REVIEWS = countOrders(
      rows.filter((r) => r.status === 'DELIVERED' && (r.reviewStatus === 'PENDING' || r.reviewStatus === 'CALLED'))
    )
    return NextResponse.json(counts)
  } catch (error: any) {
    console.error('Order counts error:', error)
    return NextResponse.json({ error: error.message || 'Could not count orders' }, { status: 500 })
  }
}
