import { NextRequest, NextResponse } from 'next/server'
import { withBalanceGuard, balanceErrorResponse } from '@/lib/balanceGuard'
import { addPurchase, inventoryErrorResponse, PaymentInput } from '@/lib/inventory'
import { nameMaps, requestActor } from '@/lib/orderLog'

export const dynamic = 'force-dynamic'

const num = (v: unknown) => (v === undefined || v === null || v === '' ? NaN : parseFloat(String(v)))

// Buy stock for an item.
// POST { quantity, unitCost, supplierId?, note?, payments: [{ personId, amount, kind: 'BUSINESS' | 'SAVINGS' }] }
// BUSINESS = paid from that person's money in hand (cannot go below zero); SAVINGS = their own investment.
export async function POST(request: NextRequest, { params }: { params: { id: string } }) {
  try {
    const body = await request.json().catch(() => ({}))
    const payments: PaymentInput[] = Array.isArray(body.payments)
      ? body.payments.map((p: any) => ({ personId: String(p.personId || ''), amount: num(p.amount) || 0, kind: p.kind }))
      : []
    const actor = await requestActor(request)
    const names = await nameMaps()
    const result = await withBalanceGuard((tx) =>
      addPurchase(
        tx,
        {
          itemId: params.id,
          quantity: parseInt(String(body.quantity), 10),
          unitCost: num(body.unitCost),
          supplierId: body.supplierId || null,
          note: typeof body.note === 'string' ? body.note : null,
          payments,
        },
        actor,
        names
      )
    )
    return NextResponse.json(result, { status: 201 })
  } catch (error: any) {
    const handled = balanceErrorResponse(error) || inventoryErrorResponse(error)
    if (handled) return NextResponse.json(handled, { status: 400 })
    return NextResponse.json({ error: error.message || 'Could not save the purchase' }, { status: 500 })
  }
}
