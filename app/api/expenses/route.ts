import { NextRequest, NextResponse } from 'next/server'
import prisma from '@/lib/prisma'
import { ExpenseCategory, FundingSource } from '@prisma/client'
import { withBalanceGuard, balanceErrorResponse } from '@/lib/balanceGuard'

export const dynamic = 'force-dynamic'

export async function GET(request: NextRequest) {
  try {
    const { searchParams } = new URL(request.url)
    const category = searchParams.get('category')
    const fundingSource = searchParams.get('fundingSource')

    const where: any = {}
    if (category && category !== 'ALL') {
      where.category = category as ExpenseCategory
    }
    if (fundingSource && fundingSource !== 'ALL') {
      where.fundingSource = fundingSource as FundingSource
    }

    const expenses = await prisma.expense.findMany({
      where,
      orderBy: { createdAt: 'desc' },
      include: { partner: true, paidBy: true },
    })

    return NextResponse.json(expenses)
  } catch (error: any) {
    console.error('Fetch expenses error:', error)
    return NextResponse.json({ error: error.message || 'Failed to fetch expenses' }, { status: 500 })
  }
}

export async function POST(request: NextRequest) {
  try {
    const body = await request.json()
    const { title, amount, category, fundingSource, partnerId, note, paidById } = body

    if (!title || amount === undefined || !category || !fundingSource) {
      return NextResponse.json({ error: 'Title, amount, category, and funding source are required.' }, { status: 400 })
    }

    const amt = parseFloat(amount)
    if (isNaN(amt) || amt <= 0) {
      return NextResponse.json({ error: 'Please enter a valid expense amount.' }, { status: 400 })
    }

    // An expense paid from a person's money cannot be more than they hold
    const expense = await withBalanceGuard(async (tx) => {
      const created = await tx.expense.create({
        data: {
          title: title.trim(),
          amount: amt,
          category: category as ExpenseCategory,
          fundingSource: fundingSource as FundingSource,
          partnerId: fundingSource === 'PERSONAL_CAPITAL' && partnerId ? partnerId : null,
          note: note ? note.trim() : null,
          paidById: paidById || null,
        },
        include: { partner: true, paidBy: true },
      })

      // If Personal Capital, increment Partner's total capital invested
      if (fundingSource === 'PERSONAL_CAPITAL' && partnerId) {
        await tx.partner.update({
          where: { id: partnerId },
          data: {
            totalCapitalInvested: {
              increment: amt,
            },
          },
        })
      }
      return created
    })

    return NextResponse.json(expense, { status: 201 })
  } catch (error: any) {
    const blocked = balanceErrorResponse(error)
    if (blocked) return NextResponse.json(blocked, { status: 400 })
    console.error('Create expense error:', error)
    return NextResponse.json({ error: error.message || 'Failed to create expense' }, { status: 500 })
  }
}
