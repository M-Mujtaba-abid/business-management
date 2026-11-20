import { NextRequest, NextResponse } from 'next/server'
import prisma from '@/lib/prisma'
import { logInventory } from '@/lib/inventory'
import { nameMaps, requestActor } from '@/lib/orderLog'

export const dynamic = 'force-dynamic'

const rs = (n: number | null | undefined) => (n == null ? '—' : `Rs. ${Math.round(n).toLocaleString('en-PK')}`)

// PATCH { name?, categoryId?, supplierId?, salePrice?, lowStockAt?, active? } → edit / archive / restore an item
export async function PATCH(request: NextRequest, { params }: { params: { id: string } }) {
  try {
    const body = await request.json().catch(() => ({}))
    const item = await prisma.inventoryItem.findUnique({ where: { id: params.id } })
    if (!item) return NextResponse.json({ error: 'Item not found' }, { status: 404 })

    const data: Record<string, unknown> = {}
    if (body.name !== undefined) {
      const name = typeof body.name === 'string' ? body.name.trim() : ''
      if (!name) return NextResponse.json({ error: 'Enter the item name.' }, { status: 400 })
      const dup = await prisma.inventoryItem.findFirst({
        where: { id: { not: item.id }, active: true, name: { equals: name, mode: 'insensitive' } },
      })
      if (dup) return NextResponse.json({ error: `"${dup.name}" is already in inventory.` }, { status: 409 })
      data.name = name
    }
    if (body.categoryId !== undefined) data.categoryId = body.categoryId || null
    if (body.supplierId !== undefined) data.supplierId = body.supplierId || null
    if (body.salePrice !== undefined) {
      const p = parseFloat(String(body.salePrice))
      data.salePrice = body.salePrice === '' || body.salePrice === null || isNaN(p) ? null : p
    }
    if (body.lowStockAt !== undefined) {
      const n = parseInt(String(body.lowStockAt), 10)
      data.lowStockAt = Number.isInteger(n) && n >= 0 ? n : null
    }
    if (typeof body.active === 'boolean') data.active = body.active

    const names = await nameMaps()
    const changes: string[] = []
    const note = (label: string, from: unknown, to: unknown) => {
      if (to !== undefined && (from ?? null) !== (to ?? null)) changes.push(`${label}: ${from ?? '—'} → ${to ?? '—'}`)
    }
    note('Name', item.name, data.name)
    if ('categoryId' in data) note('Category', item.categoryId ? names.categories.get(item.categoryId) : null, data.categoryId ? names.categories.get(String(data.categoryId)) : null)
    if ('supplierId' in data) note('Supplier', item.supplierId ? names.suppliers.get(item.supplierId) : null, data.supplierId ? names.suppliers.get(String(data.supplierId)) : null)
    if ('salePrice' in data) note('Sale price', rs(item.salePrice), rs(data.salePrice as number | null))
    note('Low stock at', item.lowStockAt, data.lowStockAt)

    const updated = await prisma.$transaction(async (tx) => {
      const u = await tx.inventoryItem.update({ where: { id: item.id }, data })
      const actor = await requestActor(request)
      if (typeof body.active === 'boolean' && body.active !== item.active) {
        await logInventory(tx, {
          itemId: item.id,
          action: body.active ? 'edited' : 'archived',
          qtyChange: 0,
          qtyAfter: u.stockQty,
          message: body.active ? 'Item restored from archive' : `Item archived (hidden) with ${u.stockQty} in stock`,
          actor,
        })
      }
      if (changes.length) {
        await logInventory(tx, { itemId: item.id, action: 'edited', qtyChange: 0, qtyAfter: u.stockQty, message: `Edited: ${changes.join(' · ')}`, actor })
      }
      return u
    })
    return NextResponse.json(updated)
  } catch (error: any) {
    return NextResponse.json({ error: error.message || 'Could not save the item' }, { status: 500 })
  }
}
