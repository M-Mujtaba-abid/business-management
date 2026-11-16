import { NextRequest, NextResponse } from 'next/server'
import prisma from '@/lib/prisma'
import { whatsappByOrder } from '@/lib/whatsapp'

export const dynamic = 'force-dynamic'

// GET ?orderNos=1187,1190 → the WhatsApp messages and the customer's reply for each order.
// The orders list polls this while a message is on its way, instead of reloading every order.
export async function GET(request: NextRequest) {
  try {
    const orderNos = Array.from(
      new Set(
        (request.nextUrl.searchParams.get('orderNos') || '')
          .split(',')
          .map((x) => parseInt(x, 10))
          .filter((n) => Number.isInteger(n) && n > 0),
      ),
    ).slice(0, 200)
    if (!orderNos.length) return NextResponse.json({ orders: {} })

    const [wa, replies] = await Promise.all([
      whatsappByOrder(orderNos),
      prisma.sale.findMany({
        where: { orderNo: { in: orderNos } },
        distinct: ['orderNo'],
        select: { orderNo: true, customerResponse: true, customerRespondedAt: true },
      }),
    ])

    const orders: Record<number, unknown> = {}
    for (const r of replies) {
      if (r.orderNo == null) continue
      orders[r.orderNo] = {
        whatsapp: wa.get(r.orderNo) || [],
        customerResponse: r.customerResponse,
        customerRespondedAt: r.customerRespondedAt,
      }
    }
    return NextResponse.json({ orders })
  } catch (error: any) {
    console.error('WhatsApp order status error:', error)
    return NextResponse.json({ error: error.message || 'Could not load WhatsApp statuses' }, { status: 500 })
  }
}
