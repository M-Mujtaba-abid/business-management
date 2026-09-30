import { NextRequest, NextResponse } from 'next/server'
import prisma from '@/lib/prisma'

export const dynamic = 'force-dynamic'

// List withdrawals, optionally for one person and/or a date range (YYYY-MM-DD, inclusive)
export async function GET(request: NextRequest) {
  try {
    const { searchParams } = new URL(request.url)
    const personId = searchParams.get('personId')
    const from = searchParams.get('from')
    const to = searchParams.get('to')

    const createdAt: { gte?: Date; lte?: Date } = {}
    if (from) {
      const [y, m, d] = from.split('-').map(Number)
      createdAt.gte = new Date(y, m - 1, d, 0, 0, 0, 0)
    }
    if (to) {
      const [y, m, d] = to.split('-').map(Number)
      createdAt.lte = new Date(y, m - 1, d, 23, 59, 59, 999)
    }

    const withdrawals = await prisma.withdrawal.findMany({
      where: {
        ...(personId ? { personId } : {}),
        ...(createdAt.gte || createdAt.lte ? { createdAt } : {}),
      },
      orderBy: { createdAt: 'desc' },
      include: { person: true },
    })
    return NextResponse.json(withdrawals)
  } catch (error: any) {
    return NextResponse.json({ error: error.message || 'Failed to fetch withdrawals' }, { status: 500 })
  }
}

export async function POST(request: NextRequest) {
  try {
    const { personId, amount, reason } = await request.json()
    const amt = parseFloat(amount)

    if (!personId) {
      return NextResponse.json({ error: 'Select a person' }, { status: 400 })
    }
    if (isNaN(amt) || amt <= 0) {
      return NextResponse.json({ error: 'Enter a valid amount' }, { status: 400 })
    }

    const withdrawal = await prisma.withdrawal.create({
      data: {
        personId,
        amount: amt,
        reason: typeof reason === 'string' && reason.trim() ? reason.trim() : null,
      },
      include: { person: true },
    })
    return NextResponse.json(withdrawal, { status: 201 })
  } catch (error: any) {
    return NextResponse.json({ error: error.message || 'Failed to save withdrawal' }, { status: 500 })
  }
}
