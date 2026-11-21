import { NextRequest, NextResponse } from 'next/server'
import prisma from '@/lib/prisma'
import { withBalanceGuard, balanceErrorResponse } from '@/lib/balanceGuard'
import { capitalByPerson } from '@/lib/capital'

class CapitalError extends Error {}

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
    const { personId, amount, reason, type } = await request.json()
    const amt = parseFloat(amount)
    // PROFIT (default) = business money for yourself; CAPITAL = taking back money you invested
    const kind: 'PROFIT' | 'CAPITAL' = type === 'CAPITAL' ? 'CAPITAL' : 'PROFIT'

    if (!personId) {
      return NextResponse.json({ error: 'Select a person' }, { status: 400 })
    }
    if (isNaN(amt) || amt <= 0) {
      return NextResponse.json({ error: 'Enter a valid amount' }, { status: 400 })
    }

    // Cannot take out more than the person holds; capital back cannot be more than they put in
    const withdrawal = await withBalanceGuard(async (tx) => {
      if (kind === 'CAPITAL') {
        const cap = (await capitalByPerson(tx)).find((c) => c.id === personId)
        if (!cap || amt > cap.net + 0.5) {
          throw new CapitalError(
            `${cap?.name || 'This person'} has Rs. ${Math.round(Math.max(0, cap?.net || 0)).toLocaleString('en-PK')} of capital in the business. Cannot take back more than that.`
          )
        }
      }
      return tx.withdrawal.create({
        data: {
          personId,
          amount: amt,
          type: kind,
          reason: typeof reason === 'string' && reason.trim() ? reason.trim() : null,
        },
        include: { person: true },
      })
    })
    return NextResponse.json(withdrawal, { status: 201 })
  } catch (error: any) {
    const blocked = balanceErrorResponse(error)
    if (blocked) return NextResponse.json(blocked, { status: 400 })
    if (error instanceof CapitalError) return NextResponse.json({ error: error.message }, { status: 400 })
    return NextResponse.json({ error: error.message || 'Failed to save withdrawal' }, { status: 500 })
  }
}
