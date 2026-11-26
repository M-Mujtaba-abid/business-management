import { NextRequest, NextResponse } from 'next/server'
import prisma from '@/lib/prisma'
import { withBalanceGuard, balanceErrorResponse } from '@/lib/balanceGuard'
import { advanceLeft } from '@/lib/supplierAdvance'

export const dynamic = 'force-dynamic'

// Delete an advance entered by mistake. Not allowed when stock was already bought from it
// (the advance left would go below zero) — delete that purchase's payment first.
export async function DELETE(_request: NextRequest, { params }: { params: { id: string } }) {
  try {
    const a = await prisma.supplierAdvance.findUnique({ where: { id: params.id } })
    if (!a) return NextResponse.json({ error: 'Advance not found' }, { status: 404 })
    const left = await advanceLeft(prisma, a.supplierId, a.personId)
    if (left - a.amount < -0.5) {
      return NextResponse.json(
        { error: `Stock was already bought from this advance (only Rs. ${Math.round(left).toLocaleString('en-PK')} is unused), so it cannot be deleted.` },
        { status: 400 }
      )
    }
    await withBalanceGuard((tx) => tx.supplierAdvance.delete({ where: { id: a.id } }))
    return NextResponse.json({ deleted: a.id })
  } catch (error: any) {
    const blocked = balanceErrorResponse(error)
    if (blocked) return NextResponse.json(blocked, { status: 400 })
    return NextResponse.json({ error: error.message || 'Could not delete' }, { status: 500 })
  }
}
