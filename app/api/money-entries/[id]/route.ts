import { NextRequest, NextResponse } from 'next/server'
import prisma from '@/lib/prisma'
import { withBalanceGuard, balanceErrorResponse } from '@/lib/balanceGuard'

export const dynamic = 'force-dynamic'

// Delete an opening balance / investment / adjustment (cannot take anyone below zero)
export async function DELETE(_request: NextRequest, { params }: { params: { id: string } }) {
  try {
    const entry = await prisma.moneyEntry.findUnique({ where: { id: params.id } })
    if (!entry) return NextResponse.json({ error: 'Entry not found' }, { status: 404 })
    await withBalanceGuard((tx) => tx.moneyEntry.delete({ where: { id: entry.id } }))
    return NextResponse.json({ deleted: entry.id })
  } catch (error: any) {
    const blocked = balanceErrorResponse(error)
    if (blocked) return NextResponse.json(blocked, { status: 400 })
    return NextResponse.json({ error: error.message || 'Could not delete' }, { status: 500 })
  }
}
