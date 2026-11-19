import { NextRequest, NextResponse } from 'next/server'
import { Prisma } from '@prisma/client'
import prisma from '@/lib/prisma'

export const dynamic = 'force-dynamic'

const PAGE = 50
const SOURCES = ['USER', 'LEOPARDS', 'WHATSAPP', 'CUSTOMER', 'SYSTEM']

// Logs page: one line per order, newest activity first.
// GET ?search=…&source=USER|LEOPARDS|…&page=0
//  → { rows: [{ orderNo, saleId, customer, phone, total, status, events, last: {…} }], hasMore }
export async function GET(request: NextRequest) {
  try {
    const sp = request.nextUrl.searchParams
    const search = (sp.get('search') || '').trim()
    const source = SOURCES.includes(sp.get('source') || '') ? (sp.get('source') as string) : null
    const page = Math.max(0, parseInt(sp.get('page') || '0', 10) || 0)

    // Search: order number, customer, phone, order ID or tracking → the matching orders
    let orderFilter = Prisma.empty
    if (search) {
      const n = parseInt(search.replace(/^#/, ''), 10)
      const matches = await prisma.sale.findMany({
        where: {
          OR: [
            ...(Number.isInteger(n) ? [{ orderNo: n }] : []),
            { customerName: { contains: search, mode: 'insensitive' as const } },
            { customerPhone: { contains: search.replace(/\s+/g, '') } },
            { externalOrderId: { contains: search, mode: 'insensitive' as const } },
            { trackingNumber: { contains: search, mode: 'insensitive' as const } },
            { productName: { contains: search, mode: 'insensitive' as const } },
          ],
        },
        select: { id: true, orderNo: true },
        take: 500,
      })
      const nos = Array.from(new Set(matches.map((m) => m.orderNo).filter((x): x is number => x != null)))
      const ids = matches.filter((m) => m.orderNo == null).map((m) => m.id)
      // a deleted order can still be found by its number
      if (Number.isInteger(n) && !nos.includes(n)) nos.push(n)
      if (!nos.length && !ids.length) return NextResponse.json({ rows: [], hasMore: false })
      orderFilter = Prisma.sql`AND (${nos.length ? Prisma.sql`"orderNo" IN (${Prisma.join(nos)})` : Prisma.sql`FALSE`}
        OR ${ids.length ? Prisma.sql`"saleId" IN (${Prisma.join(ids)})` : Prisma.sql`FALSE`})`
    }
    const sourceFilter = source ? Prisma.sql`AND "source" = ${source}::"LogSource"` : Prisma.empty

    const latest = await prisma.$queryRaw<
      { orderNo: number | null; saleId: string | null; action: string; message: string; source: string; actor: string | null; createdAt: Date; events: bigint }[]
    >`
      WITH l AS (
        SELECT *,
               COUNT(*) OVER (PARTITION BY COALESCE('#' || "orderNo"::text, "saleId")) AS events,
               ROW_NUMBER() OVER (PARTITION BY COALESCE('#' || "orderNo"::text, "saleId") ORDER BY "createdAt" DESC, "id" DESC) AS rn
        FROM "OrderLog"
        WHERE TRUE ${orderFilter} ${sourceFilter}
      )
      SELECT "orderNo", "saleId", "action", "message", "source"::text AS source, "actor", "createdAt", events
      FROM l WHERE rn = 1
      ORDER BY "createdAt" DESC, "orderNo" DESC NULLS LAST
      LIMIT ${PAGE + 1} OFFSET ${page * PAGE}
    `
    const hasMore = latest.length > PAGE
    const list = latest.slice(0, PAGE)

    // Order details (customer, amount, status) for the lines
    const nos = list.map((r) => r.orderNo).filter((x): x is number => x != null)
    const ids = list.filter((r) => r.orderNo == null && r.saleId).map((r) => r.saleId as string)
    const sales = await prisma.sale.findMany({
      where: { OR: [{ orderNo: { in: nos } }, { id: { in: ids } }] },
      select: { id: true, orderNo: true, customerName: true, customerPhone: true, soldPrice: true, quantity: true, status: true, paymentStatus: true },
    })
    const info = new Map<string, { saleId: string; customer: string; phone: string | null; total: number; status: string; paymentStatus: string }>()
    for (const s of sales) {
      const key = s.orderNo != null ? `#${s.orderNo}` : s.id
      const cur = info.get(key)
      if (cur) cur.total += s.soldPrice * s.quantity
      else
        info.set(key, {
          saleId: s.id,
          customer: s.customerName,
          phone: s.customerPhone,
          total: s.soldPrice * s.quantity,
          status: s.status,
          paymentStatus: s.paymentStatus,
        })
    }

    const rows = list.map((r) => {
      const key = r.orderNo != null ? `#${r.orderNo}` : (r.saleId as string)
      const o = info.get(key)
      return {
        orderNo: r.orderNo,
        saleId: o?.saleId ?? r.saleId,
        customer: o?.customer ?? null,
        phone: o?.phone ?? null,
        total: o?.total ?? null,
        status: o?.status ?? 'DELETED',
        paymentStatus: o?.paymentStatus ?? null,
        events: Number(r.events),
        last: { action: r.action, message: r.message, source: r.source, actor: r.actor, at: r.createdAt },
      }
    })
    return NextResponse.json({ rows, hasMore })
  } catch (error: any) {
    console.error('Order logs list error:', error)
    return NextResponse.json({ error: error.message || 'Could not load the logs' }, { status: 500 })
  }
}
