import { NextRequest, NextResponse } from 'next/server'
import prisma from '@/lib/prisma'

export const dynamic = 'force-dynamic'

const PAGE = 60

// GET ?itemId=…&page=0 → stock movements, newest first (all items when itemId is missing)
export async function GET(request: NextRequest) {
  try {
    const sp = request.nextUrl.searchParams
    const itemId = sp.get('itemId')
    const page = Math.max(0, parseInt(sp.get('page') || '0', 10) || 0)
    const logs = await prisma.inventoryLog.findMany({
      where: itemId ? { itemId } : {},
      orderBy: [{ createdAt: 'desc' }, { id: 'desc' }],
      skip: page * PAGE,
      take: PAGE + 1,
      include: { item: { select: { name: true } } },
    })
    return NextResponse.json({ logs: logs.slice(0, PAGE), hasMore: logs.length > PAGE })
  } catch (error: any) {
    return NextResponse.json({ error: error.message || 'Could not load stock movements' }, { status: 500 })
  }
}
