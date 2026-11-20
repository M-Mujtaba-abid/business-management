import { NextRequest, NextResponse } from 'next/server'
import prisma from '@/lib/prisma'
import { withBalanceGuard, balanceErrorResponse } from '@/lib/balanceGuard'
import { addPurchase, inventoryErrorResponse, InventoryError, logInventory, PaymentInput } from '@/lib/inventory'
import { nameMaps, requestActor } from '@/lib/orderLog'

export const dynamic = 'force-dynamic'

// GET ?search=…&inStock=1&archived=1 → inventory items (newest name order), with category / supplier
export async function GET(request: NextRequest) {
  try {
    const sp = request.nextUrl.searchParams
    const search = (sp.get('search') || '').trim()
    const items = await prisma.inventoryItem.findMany({
      where: {
        active: sp.get('archived') === '1' ? undefined : true,
        ...(sp.get('inStock') === '1' ? { stockQty: { gt: 0 } } : {}),
        ...(search ? { name: { contains: search, mode: 'insensitive' as const } } : {}),
      },
      orderBy: { name: 'asc' },
      include: { category: { select: { id: true, name: true } }, supplier: { select: { id: true, name: true } } },
    })
    return NextResponse.json(items)
  } catch (error: any) {
    return NextResponse.json({ error: error.message || 'Could not load inventory' }, { status: 500 })
  }
}

const num = (v: unknown) => (v === undefined || v === null || v === '' ? NaN : parseFloat(String(v)))

// POST { name, categoryId?, supplierId?, salePrice?, lowStockAt?, opening?: { quantity, unitCost, payments[] } }
// Adds an item; opening stock is saved as its first purchase (with who paid).
export async function POST(request: NextRequest) {
  try {
    const body = await request.json().catch(() => ({}))
    const name = typeof body.name === 'string' ? body.name.trim() : ''
    if (!name) return NextResponse.json({ error: 'Enter the item name.' }, { status: 400 })
    const dup = await prisma.inventoryItem.findFirst({ where: { active: true, name: { equals: name, mode: 'insensitive' } } })
    if (dup) return NextResponse.json({ error: `"${dup.name}" is already in inventory. Use "Buy stock" on it.` }, { status: 409 })

    const salePrice = num(body.salePrice)
    const lowStockAt = parseInt(String(body.lowStockAt ?? ''), 10)
    const actor = await requestActor(request)
    const names = await nameMaps()
    const opening = body.opening && parseInt(String(body.opening.quantity), 10) > 0 ? body.opening : null

    const item = await withBalanceGuard(async (tx) => {
      const created = await tx.inventoryItem.create({
        data: {
          name,
          categoryId: body.categoryId || null,
          supplierId: body.supplierId || null,
          salePrice: isNaN(salePrice) ? null : salePrice,
          lowStockAt: Number.isInteger(lowStockAt) && lowStockAt >= 0 ? lowStockAt : null,
        },
      })
      await logInventory(tx, {
        itemId: created.id,
        action: 'created',
        qtyChange: 0,
        qtyAfter: 0,
        message: `Item added to inventory${isNaN(salePrice) ? '' : ` · sale price Rs. ${Math.round(salePrice).toLocaleString('en-PK')}`}`,
        actor,
        details: { categoryId: created.categoryId, supplierId: created.supplierId },
      })
      if (opening) {
        const payments: PaymentInput[] = Array.isArray(opening.payments) ? opening.payments.map((p: any) => ({ personId: p.personId, amount: num(p.amount) || 0, kind: p.kind })) : []
        const unitCost = num(opening.unitCost)
        if (isNaN(unitCost)) throw new InventoryError('Enter the buy price of the opening stock.')
        await addPurchase(
          tx,
          { itemId: created.id, quantity: parseInt(String(opening.quantity), 10), unitCost, supplierId: body.supplierId || null, note: 'Opening stock', payments },
          actor,
          names
        )
      }
      return tx.inventoryItem.findUniqueOrThrow({ where: { id: created.id } })
    })
    return NextResponse.json(item, { status: 201 })
  } catch (error: any) {
    const handled = balanceErrorResponse(error) || inventoryErrorResponse(error)
    if (handled) return NextResponse.json(handled, { status: 400 })
    return NextResponse.json({ error: error.message || 'Could not add the item' }, { status: 500 })
  }
}
