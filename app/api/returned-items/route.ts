import { NextRequest, NextResponse } from 'next/server'
import prisma from '@/lib/prisma'
import { ReturnedItemStatus } from '@prisma/client'

export const dynamic = 'force-dynamic'

export async function GET(request: NextRequest) {
  try {
    const { searchParams } = new URL(request.url)
    const status = (searchParams.get('status') || 'AVAILABLE') as ReturnedItemStatus | 'ALL'

    const items = await prisma.returnedItem.findMany({
      where: status === 'ALL' ? {} : { status },
      orderBy: { createdAt: 'desc' },
      include: { category: true },
    })
    return NextResponse.json(items)
  } catch (error: any) {
    return NextResponse.json({ error: error.message || 'Failed to fetch returned items' }, { status: 500 })
  }
}
