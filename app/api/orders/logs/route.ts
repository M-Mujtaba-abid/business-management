import { NextRequest, NextResponse } from 'next/server'
import prisma from '@/lib/prisma'

export const dynamic = 'force-dynamic'

// GET ?orderNo=1194        → every history line of that order, oldest first
// GET ?saleId=<id>         → same, for an older order without an order number
export async function GET(request: NextRequest) {
  try {
    const sp = request.nextUrl.searchParams
    const orderNo = parseInt(sp.get('orderNo') || '', 10)
    const saleId = sp.get('saleId')

    let where: { orderNo?: number; saleId?: { in: string[] } }
    if (Number.isInteger(orderNo)) {
      where = { orderNo }
    } else if (saleId) {
      // every product row of the parcel, in case the history was written against another row
      const sale = await prisma.sale.findUnique({ where: { id: saleId }, select: { parcelId: true } })
      const ids = sale?.parcelId
        ? (await prisma.sale.findMany({ where: { parcelId: sale.parcelId }, select: { id: true } })).map((s) => s.id)
        : [saleId]
      where = { saleId: { in: ids } }
    } else {
      return NextResponse.json({ error: 'orderNo or saleId is required' }, { status: 400 })
    }

    const logs = await prisma.orderLog.findMany({ where, orderBy: [{ createdAt: 'asc' }, { id: 'asc' }], take: 500 })
    return NextResponse.json(logs)
  } catch (error: any) {
    return NextResponse.json({ error: error.message || 'Could not load the order history' }, { status: 500 })
  }
}
