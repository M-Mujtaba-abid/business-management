import { NextRequest, NextResponse } from 'next/server'
import prisma from '@/lib/prisma'
import { withBalanceGuard, balanceErrorResponse } from '@/lib/balanceGuard'

export const dynamic = 'force-dynamic'

// Delete a transfer entered by mistake (the receiver cannot go below zero)
export async function DELETE(_request: NextRequest, { params }: { params: { id: string } }) {
  try {
    const t = await prisma.moneyTransfer.findUnique({ where: { id: params.id } })
    if (!t) return NextResponse.json({ error: 'Transfer not found' }, { status: 404 })
    await withBalanceGuard((tx) => tx.moneyTransfer.delete({ where: { id: t.id } }))
    return NextResponse.json({ deleted: t.id })
  } catch (error: any) {
    const blocked = balanceErrorResponse(error)
    if (blocked) return NextResponse.json(blocked, { status: 400 })
    return NextResponse.json({ error: error.message || 'Could not delete' }, { status: 500 })
  }
}
