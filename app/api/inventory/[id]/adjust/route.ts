import { NextRequest, NextResponse } from 'next/server'
import prisma from '@/lib/prisma'
import { InventoryError, inventoryErrorResponse, logInventory } from '@/lib/inventory'
import { requestActor } from '@/lib/orderLog'

export const dynamic = 'force-dynamic'

// Correct the stock count without buying or selling (counted again, damaged, lost, gift...).
// POST { change: +/- whole number, reason } — money is not touched.
export async function POST(request: NextRequest, { params }: { params: { id: string } }) {
  try {
    const body = await request.json().catch(() => ({}))
    const change = parseInt(String(body.change), 10)
    const reason = typeof body.reason === 'string' ? body.reason.trim() : ''
    if (!Number.isInteger(change) || change === 0) return NextResponse.json({ error: 'Enter how many to add (+) or remove (−).' }, { status: 400 })
    if (!reason) return NextResponse.json({ error: 'Write why (e.g. counted again, damaged, lost).' }, { status: 400 })

    const actor = await requestActor(request)
    const item = await prisma.$transaction(async (tx) => {
      // never below zero (atomic)
      const res = await tx.inventoryItem.updateMany({
        where: { id: params.id, ...(change < 0 ? { stockQty: { gte: -change } } : {}) },
        data: { stockQty: { increment: change } },
      })
      const it = await tx.inventoryItem.findUnique({ where: { id: params.id } })
      if (!it) throw new InventoryError('Item not found.')
      if (res.count === 0) throw new InventoryError(`Only ${it.stockQty} in stock, cannot remove ${-change}.`)
      await logInventory(tx, {
        itemId: it.id,
        action: 'adjusted',
        qtyChange: change,
        qtyAfter: it.stockQty,
        unitCost: it.avgCost,
        amount: Math.round(Math.abs(change) * it.avgCost * 100) / 100,
        message: `Stock adjusted ${change > 0 ? '+' : ''}${change} (${reason}) · ${it.stockQty} in stock`,
        actor,
        details: { reason },
      })
      return it
    })
    return NextResponse.json(item)
  } catch (error: any) {
    const handled = inventoryErrorResponse(error)
    if (handled) return NextResponse.json(handled, { status: 400 })
    return NextResponse.json({ error: error.message || 'Could not adjust the stock' }, { status: 500 })
  }
}
