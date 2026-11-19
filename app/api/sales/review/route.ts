import { NextRequest, NextResponse } from 'next/server'
import prisma from '@/lib/prisma'
import { logOrder, orderRef, ordersOf, requestActor, REVIEW_WORDS } from '@/lib/orderLog'

export const dynamic = 'force-dynamic'

const STEPS = ['PENDING', 'CALLED', 'REVIEWED', 'DECLINED'] as const
type Step = (typeof STEPS)[number]

// Move delivered orders along the review follow-up: { saleIds, reviewStatus }
// A parcel moves together (all its products get the same step).
export async function PATCH(request: NextRequest) {
  try {
    const body = (await request.json().catch(() => ({}))) as { saleIds?: string[]; reviewStatus?: Step }
    const { saleIds, reviewStatus } = body

    if (!Array.isArray(saleIds) || saleIds.length === 0) {
      return NextResponse.json({ error: 'No orders selected' }, { status: 400 })
    }
    if (!reviewStatus || !STEPS.includes(reviewStatus)) {
      return NextResponse.json({ error: 'Invalid review step' }, { status: 400 })
    }

    // Include every product of the parcels these rows belong to
    const rows = await prisma.sale.findMany({ where: { id: { in: saleIds } }, select: { id: true, parcelId: true } })
    const parcelIds = rows.map((r) => r.parcelId).filter(Boolean) as string[]
    const where = {
      OR: [{ id: { in: saleIds } }, ...(parcelIds.length ? [{ parcelId: { in: parcelIds } }] : [])],
      status: 'DELIVERED' as const, // only delivered orders are asked for a review
    }
    const before = await prisma.sale.findMany({
      where,
      select: { id: true, orderNo: true, parcelId: true, reviewStatus: true, customerName: true, customerPhone: true },
    })

    const result = await prisma.sale.updateMany({ where, data: { reviewStatus, reviewStatusAt: new Date() } })
    if (result.count === 0) {
      return NextResponse.json({ error: 'Only delivered orders can be asked for a review' }, { status: 400 })
    }

    // Order history
    const actor = await requestActor(request)
    await logOrder(
      ordersOf(before.filter((s) => s.reviewStatus !== reviewStatus)).map((g) => ({
        ...orderRef(g),
        action: 'review',
        message: `Review: ${REVIEW_WORDS[g[0].reviewStatus]} → ${REVIEW_WORDS[reviewStatus]}${
          reviewStatus === 'CALLED' && g[0].customerPhone ? ` (${g[0].customerPhone})` : ''
        }`,
        actor,
        details: { from: g[0].reviewStatus, to: reviewStatus },
      }))
    )
    return NextResponse.json({ updated: result.count })
  } catch (error: any) {
    return NextResponse.json({ error: error.message || 'Failed to update review' }, { status: 500 })
  }
}
