import { NextRequest, NextResponse } from 'next/server'
import prisma from '@/lib/prisma'

export const dynamic = 'force-dynamic'

export async function GET() {
  try {
    const sources = await prisma.paymentSource.findMany({ orderBy: { name: 'asc' } })

    // Person who received this source's money on the latest order (used to pre-fill new orders)
    const withLastReceiver = await Promise.all(
      sources.map(async (src) => {
        const last = await prisma.sale.findFirst({
          where: { paymentSourceId: src.id, receivedById: { not: null } },
          orderBy: { createdAt: 'desc' },
          select: { receivedById: true },
        })
        return { ...src, lastReceivedById: last?.receivedById ?? null }
      })
    )
    return NextResponse.json(withLastReceiver)
  } catch (error: any) {
    return NextResponse.json({ error: error.message || 'Failed to fetch payment sources' }, { status: 500 })
  }
}

export async function POST(request: NextRequest) {
  try {
    const { name } = await request.json()
    const trimmed = typeof name === 'string' ? name.trim() : ''

    if (!trimmed) {
      return NextResponse.json({ error: 'Name is required' }, { status: 400 })
    }

    // Return the existing source if the same name (any case) already exists
    const existing = await prisma.paymentSource.findFirst({
      where: { name: { equals: trimmed, mode: 'insensitive' } },
    })
    if (existing) return NextResponse.json(existing)

    const source = await prisma.paymentSource.create({ data: { name: trimmed } })
    return NextResponse.json(source, { status: 201 })
  } catch (error: any) {
    return NextResponse.json({ error: error.message || 'Failed to create payment source' }, { status: 500 })
  }
}
