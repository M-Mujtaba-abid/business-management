import { NextRequest, NextResponse } from 'next/server'
import { loadBill, renderBillPng, billFileName } from '@/lib/bill'

export const dynamic = 'force-dynamic'
export const runtime = 'nodejs'

// The order's bill as a PNG.  ?delivery=200 adds a delivery charge, ?download=1 saves it as a file.
export async function GET(request: NextRequest, { params }: { params: { id: string } }) {
  try {
    const sp = request.nextUrl.searchParams
    const delivery = parseFloat(sp.get('delivery') || '0')
    if (!Number.isFinite(delivery) || delivery < 0 || delivery > 1_000_000) {
      return NextResponse.json({ error: 'Invalid delivery charge.' }, { status: 400 })
    }
    const bill = await loadBill(params.id, delivery)
    if (!bill) return NextResponse.json({ error: 'Order not found' }, { status: 404 })

    const png = await renderBillPng(bill)
    return new NextResponse(png, {
      headers: {
        'Content-Type': 'image/png',
        'Cache-Control': 'no-store',
        'Content-Disposition': `${sp.get('download') === '1' ? 'attachment' : 'inline'}; filename="${billFileName(bill)}"`,
      },
    })
  } catch (error: any) {
    console.error('Bill error:', error)
    return NextResponse.json({ error: error.message || 'Could not make the bill' }, { status: 500 })
  }
}
