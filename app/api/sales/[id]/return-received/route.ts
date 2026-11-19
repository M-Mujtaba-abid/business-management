import { NextRequest, NextResponse } from 'next/server'
import prisma from '@/lib/prisma'
import { logOrder, orderRef, requestActor } from '@/lib/orderLog'

export const dynamic = 'force-dynamic'

// Marks a returned order's parcel as physically back with us (or still on its way).
// A parcel's products always come back together, so every row of the parcel is updated.
// Body: { received: boolean }
export async function PATCH(request: NextRequest, { params }: { params: { id: string } }) {
  try {
    const { received } = (await request.json()) as { received?: unknown }
    if (typeof received !== 'boolean') {
      return NextResponse.json({ error: '"received" must be true or false.' }, { status: 400 })
    }

    const sale = await prisma.sale.findUnique({
      where: { id: params.id },
      select: { id: true, parcelId: true, status: true, orderNo: true, returnReceived: true },
    })
    if (!sale) return NextResponse.json({ error: 'Order not found' }, { status: 404 })
    if (sale.status !== 'RETURNED') {
      return NextResponse.json({ error: 'Only a returned order can be marked as received back.' }, { status: 400 })
    }

    const where = sale.parcelId ? { parcelId: sale.parcelId, status: 'RETURNED' as const } : { id: sale.id }
    const now = new Date()
    await prisma.sale.updateMany({
      where,
      data: { returnReceived: received, returnReceivedAt: received ? now : null },
    })

    if (sale.returnReceived !== received) {
      await logOrder({
        ...orderRef([sale]),
        action: 'return_received',
        message: received ? 'Returned parcel received back' : 'Returned parcel changed back to "not back yet"',
        actor: await requestActor(request),
        details: { received },
      })
    }

    return NextResponse.json({ ok: true, returnReceived: received, returnReceivedAt: received ? now : null })
  } catch (error: any) {
    console.error('Return received error:', error)
    return NextResponse.json({ error: error.message || 'Could not update the return' }, { status: 500 })
  }
}
