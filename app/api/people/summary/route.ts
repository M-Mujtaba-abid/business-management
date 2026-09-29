import { NextRequest, NextResponse } from 'next/server'
import prisma from '@/lib/prisma'

export const dynamic = 'force-dynamic'

// How much order money each person has received (in a period) and is still expecting
export async function GET(request: NextRequest) {
  try {
    const { searchParams } = new URL(request.url)
    const from = searchParams.get('from') // YYYY-MM-DD, inclusive
    const to = searchParams.get('to') // YYYY-MM-DD, inclusive

    const receivedAt: { gte?: Date; lte?: Date } = {}
    if (from) {
      const [y, m, d] = from.split('-').map(Number)
      receivedAt.gte = new Date(y, m - 1, d, 0, 0, 0, 0)
    }
    if (to) {
      const [y, m, d] = to.split('-').map(Number)
      receivedAt.lte = new Date(y, m - 1, d, 23, 59, 59, 999)
    }

    const [people, received, expected] = await Promise.all([
      prisma.person.findMany({ orderBy: { name: 'asc' } }),
      prisma.sale.findMany({
        where: {
          paymentStatus: 'RECEIVED',
          ...(receivedAt.gte || receivedAt.lte ? { paymentReceivedAt: receivedAt } : {}),
        },
        select: { receivedById: true, soldPrice: true, quantity: true },
      }),
      // Still to come in (delivered, not received): not tied to the period
      prisma.sale.findMany({
        where: { paymentStatus: 'NOT_RECEIVED', status: 'DELIVERED' },
        select: { receivedById: true, soldPrice: true, quantity: true },
      }),
    ])

    const build = (id: string | null, name: string) => {
      const got = received.filter((s) => s.receivedById === id)
      const coming = expected.filter((s) => s.receivedById === id)
      return {
        id,
        name,
        receivedAmount: got.reduce((acc, s) => acc + s.soldPrice * s.quantity, 0),
        receivedCount: got.length,
        expectedAmount: coming.reduce((acc, s) => acc + s.soldPrice * s.quantity, 0),
        expectedCount: coming.length,
      }
    }

    const summary = people.map((p) => build(p.id, p.name))

    // Orders saved without a person
    const unassigned = build(null, 'No person set')
    if (unassigned.receivedCount > 0 || unassigned.expectedCount > 0) summary.push(unassigned)

    return NextResponse.json(summary)
  } catch (error: any) {
    return NextResponse.json({ error: error.message || 'Failed to fetch money summary' }, { status: 500 })
  }
}
