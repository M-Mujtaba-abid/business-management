import { NextRequest, NextResponse } from 'next/server'
import prisma from '@/lib/prisma'

export const dynamic = 'force-dynamic'

// Delivery charges paid from one person's account, one entry per order (a parcel's DC is added up),
// optionally for a date range (YYYY-MM-DD, inclusive, by order date). Cancelled orders are left out.
export async function GET(request: NextRequest) {
  try {
    const { searchParams } = new URL(request.url)
    const personId = searchParams.get('personId')
    const from = searchParams.get('from')
    const to = searchParams.get('to')

    if (!personId) {
      return NextResponse.json({ error: 'Select a person' }, { status: 400 })
    }

    const createdAt: { gte?: Date; lte?: Date } = {}
    if (from) {
      const [y, m, d] = from.split('-').map(Number)
      createdAt.gte = new Date(y, m - 1, d, 0, 0, 0, 0)
    }
    if (to) {
      const [y, m, d] = to.split('-').map(Number)
      createdAt.lte = new Date(y, m - 1, d, 23, 59, 59, 999)
    }

    const sales = await prisma.sale.findMany({
      where: {
        dcPaidById: personId,
        status: { not: 'CANCELLED' },
        ...(createdAt.gte || createdAt.lte ? { createdAt } : {}),
      },
      orderBy: { createdAt: 'desc' },
      select: {
        id: true,
        parcelId: true,
        orderNo: true,
        externalOrderId: true,
        trackingNumber: true,
        customerName: true,
        deliveryCharge: true,
        status: true,
        createdAt: true,
      },
    })

    const byOrder = new Map<string, {
      orderNo: number | null
      externalOrderId: string | null
      trackingNumber: string | null
      customerName: string
      dc: number
      status: string
      createdAt: Date
    }>()
    for (const s of sales) {
      const key = s.parcelId || s.id
      const entry = byOrder.get(key)
      if (entry) entry.dc = Math.round((entry.dc + s.deliveryCharge) * 100) / 100
      else
        byOrder.set(key, {
          orderNo: s.orderNo,
          externalOrderId: s.externalOrderId,
          trackingNumber: s.trackingNumber,
          customerName: s.customerName,
          dc: s.deliveryCharge,
          status: s.status,
          createdAt: s.createdAt,
        })
    }

    return NextResponse.json(Array.from(byOrder.values()))
  } catch (error: any) {
    return NextResponse.json({ error: error.message || 'Failed to fetch DC log' }, { status: 500 })
  }
}
