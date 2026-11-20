import { NextRequest, NextResponse } from 'next/server'
import prisma from '@/lib/prisma'

export const dynamic = 'force-dynamic'

// The Leopards label (slip) of an order booked from the app. Fetched here on the server, because
// Leopards' slip link can carry our account details; the browser only ever sees this route.
export async function GET(_request: NextRequest, { params }: { params: { id: string } }) {
  try {
    const sale = await prisma.sale.findUnique({ where: { id: params.id }, select: { courierSlipUrl: true, trackingNumber: true } })
    if (!sale?.courierSlipUrl) {
      return NextResponse.json({ error: 'No Leopards slip for this order (only orders booked from the app have one).' }, { status: 404 })
    }
    const res = await fetch(sale.courierSlipUrl, { cache: 'no-store', signal: AbortSignal.timeout(30000) })
    if (!res.ok) return NextResponse.json({ error: `Leopards did not return the slip (${res.status}).` }, { status: 502 })
    const type = res.headers.get('content-type') || 'application/pdf'
    const data = await res.arrayBuffer()
    return new NextResponse(data, {
      headers: {
        'Content-Type': type,
        'Content-Disposition': `inline; filename="leopards-${sale.trackingNumber || 'slip'}${type.includes('pdf') ? '.pdf' : ''}"`,
        'Cache-Control': 'private, no-store',
      },
    })
  } catch (error: any) {
    return NextResponse.json({ error: error.message || 'Could not load the slip' }, { status: 500 })
  }
}
