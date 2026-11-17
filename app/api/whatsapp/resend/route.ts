import { NextRequest, NextResponse } from 'next/server'
import prisma from '@/lib/prisma'
import { notifyOrder } from '@/lib/whatsapp'

export const dynamic = 'force-dynamic'

const KINDS = ['ORDER_CONFIRM', 'DISPATCHED', 'DELIVERED'] as const
type ResendKind = (typeof KINDS)[number]

// Sends an order's WhatsApp message again (after it failed, or the customer asks for it again)
export async function POST(request: NextRequest) {
  try {
    const { orderNo, kind } = (await request.json()) as { orderNo?: number; kind?: ResendKind }
    const no = Number(orderNo)
    if (!Number.isInteger(no) || !kind || !KINDS.includes(kind)) {
      return NextResponse.json({ error: 'orderNo and a valid kind are required.' }, { status: 400 })
    }
    const lead = await prisma.sale.findFirst({ where: { orderNo: no }, select: { customerPhone: true } })
    if (!lead) return NextResponse.json({ error: 'Order not found' }, { status: 404 })
    if (!lead.customerPhone) return NextResponse.json({ error: 'This order has no customer phone number.' }, { status: 400 })

    await notifyOrder(no, kind, { force: true })
    const msg = await prisma.whatsAppMessage.findUnique({
      where: { orderNo_kind: { orderNo: no, kind } },
      select: { kind: true, status: true, error: true, sentAt: true },
    })
    if (msg?.status === 'FAILED') return NextResponse.json({ error: msg.error || 'Could not send', message: msg }, { status: 502 })
    return NextResponse.json({ ok: true, message: msg })
  } catch (error: any) {
    console.error('WhatsApp resend error:', error)
    return NextResponse.json({ error: error.message || 'Failed to resend' }, { status: 500 })
  }
}
