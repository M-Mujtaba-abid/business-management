import { NextRequest, NextResponse } from 'next/server'
import { loadBill, renderBillPng, billTotals, SHOP } from '@/lib/bill'
import prisma from '@/lib/prisma'
import { sendBill, whatsappBlockedFor } from '@/lib/whatsapp'

export const dynamic = 'force-dynamic'
export const runtime = 'nodejs'

// May this order's bill go out on WhatsApp? → { allowed, reason }
export async function GET(_request: NextRequest, { params }: { params: { id: string } }) {
  try {
    const sale = await prisma.sale.findUnique({ where: { id: params.id }, select: { orderSourceId: true } })
    if (!sale) return NextResponse.json({ error: 'Order not found' }, { status: 404 })
    const reason = await whatsappBlockedFor(sale.orderSourceId)
    return NextResponse.json({ allowed: !reason, reason })
  } catch (error: any) {
    return NextResponse.json({ error: error.message || 'Could not check' }, { status: 500 })
  }
}

// Sends the order's bill picture to the customer on WhatsApp. Body: { delivery?: number }
export async function POST(request: NextRequest, { params }: { params: { id: string } }) {
  try {
    const body = await request.json().catch(() => ({}))
    const delivery = parseFloat(String(body?.delivery ?? 0))
    if (!Number.isFinite(delivery) || delivery < 0 || delivery > 1_000_000) {
      return NextResponse.json({ error: 'Invalid delivery charge.' }, { status: 400 })
    }
    const bill = await loadBill(params.id, delivery)
    if (!bill) return NextResponse.json({ error: 'Order not found' }, { status: 404 })
    if (bill.whatsappBlocked) return NextResponse.json({ error: bill.whatsappBlocked }, { status: 403 })
    if (!bill.orderNo) return NextResponse.json({ error: 'This order has no order number.' }, { status: 400 })
    if (!bill.customerPhone) return NextResponse.json({ error: 'This order has no customer phone number.' }, { status: 400 })

    const png = await renderBillPng(bill)
    const caption = `🧾 ${SHOP.name} bill: Order #${bill.orderNo}\nTotal: Rs ${Math.round(billTotals(bill).total).toLocaleString('en-US')}`
    const error = await sendBill(bill.orderNo, bill.customerPhone, png, caption)
    if (error) return NextResponse.json({ error }, { status: 502 })
    return NextResponse.json({ ok: true, queued: true })
  } catch (error: any) {
    console.error('Bill WhatsApp error:', error)
    return NextResponse.json({ error: error.message || 'Could not send the bill' }, { status: 500 })
  }
}
