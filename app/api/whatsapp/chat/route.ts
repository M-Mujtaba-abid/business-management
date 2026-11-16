import { NextRequest, NextResponse } from 'next/server'
import prisma from '@/lib/prisma'
import { toWaPhone } from '@/lib/whatsapp'

export const dynamic = 'force-dynamic'

const MAX_MESSAGES = 300

// GET ?phone=03001234567  → the conversation with that customer (oldest first)
// GET (no phone)          → recent conversations, newest first, for the WhatsApp page
export async function GET(request: NextRequest) {
  try {
    const raw = request.nextUrl.searchParams.get('phone')

    if (raw) {
      const phone = toWaPhone(raw)
      if (!phone) return NextResponse.json({ error: 'Invalid phone number.' }, { status: 400 })
      const latest = await prisma.whatsAppChat.findMany({
        where: { phone },
        orderBy: { createdAt: 'desc' },
        take: MAX_MESSAGES,
        select: { id: true, direction: true, body: true, orderNo: true, manual: true, createdAt: true },
      })
      const optedOut = Boolean(await prisma.whatsAppOptOut.findUnique({ where: { phone } }))
      return NextResponse.json({ phone, optedOut, messages: latest.reverse() })
    }

    // Last message of each conversation
    const last = await prisma.$queryRaw<
      { phone: string; body: string; direction: 'IN' | 'OUT'; createdAt: Date; total: bigint }[]
    >`
      SELECT DISTINCT ON (c."phone") c."phone", c."body", c."direction", c."createdAt",
             COUNT(*) OVER (PARTITION BY c."phone") AS total
      FROM "WhatsAppChat" c
      ORDER BY c."phone", c."createdAt" DESC
    `
    last.sort((a, b) => b.createdAt.getTime() - a.createdAt.getTime())
    const top = last.slice(0, 100)

    // Customer name and latest order for each number
    const msgs = await prisma.whatsAppMessage.findMany({
      where: { phone: { in: top.map((c) => c.phone) } },
      orderBy: { createdAt: 'desc' },
      distinct: ['phone'],
      select: { phone: true, orderNo: true },
    })
    const orderByPhone = new Map(msgs.map((m) => [m.phone, m.orderNo]))
    const sales = await prisma.sale.findMany({
      where: { orderNo: { in: msgs.map((m) => m.orderNo) } },
      distinct: ['orderNo'],
      select: { orderNo: true, customerName: true, customerPhone: true },
    })
    const saleByNo = new Map(sales.map((s) => [s.orderNo, s]))
    const stopped = new Set(
      (await prisma.whatsAppOptOut.findMany({ where: { phone: { in: top.map((c) => c.phone) } }, select: { phone: true } })).map(
        (o) => o.phone,
      ),
    )

    return NextResponse.json({
      conversations: top.map((c) => {
        const orderNo = orderByPhone.get(c.phone) ?? null
        const sale = orderNo ? saleByNo.get(orderNo) : undefined
        return {
          phone: c.phone,
          customerPhone: sale?.customerPhone || `+${c.phone}`,
          customerName: sale?.customerName || null,
          orderNo,
          lastBody: c.body,
          lastDirection: c.direction,
          lastAt: c.createdAt,
          total: Number(c.total),
          optedOut: stopped.has(c.phone),
        }
      }),
    })
  } catch (error: any) {
    console.error('WhatsApp chat GET error:', error)
    return NextResponse.json({ error: error.message || 'Could not load the chat' }, { status: 500 })
  }
}
