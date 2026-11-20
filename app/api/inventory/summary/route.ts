import { NextRequest, NextResponse } from 'next/server'
import prisma from '@/lib/prisma'
import { countOrders } from '@/lib/saleMoney'

export const dynamic = 'force-dynamic'

// Payments page → Inventory money. GET ?from=YYYY-MM-DD&to=YYYY-MM-DD (inclusive; both optional)
//  onHand   – stock now (units, value at average cost)
//  bought   – stock bought in the period, and who paid (from in hand / from savings)
//  invested – all-time money each person put in from personal savings
//  sold     – orders that took stock in the period (by order date): sales, cost, profit
//  items    – the same per item
export async function GET(request: NextRequest) {
  try {
    const sp = request.nextUrl.searchParams
    const range: { gte?: Date; lte?: Date } = {}
    const from = sp.get('from')
    const to = sp.get('to')
    if (from) {
      const [y, m, d] = from.split('-').map(Number)
      range.gte = new Date(y, m - 1, d, 0, 0, 0, 0)
    }
    if (to) {
      const [y, m, d] = to.split('-').map(Number)
      range.lte = new Date(y, m - 1, d, 23, 59, 59, 999)
    }
    const createdAt = range.gte || range.lte ? range : undefined

    const [items, purchases, allSavings, sales, people] = await Promise.all([
      prisma.inventoryItem.findMany({ where: { active: true }, select: { id: true, name: true, stockQty: true, avgCost: true, lowStockAt: true } }),
      prisma.stockPurchase.findMany({
        where: createdAt ? { createdAt } : {},
        select: { id: true, itemId: true, quantity: true, totalCost: true, payments: { select: { personId: true, amount: true, kind: true } } },
      }),
      prisma.stockPayment.findMany({ where: { kind: 'SAVINGS' }, select: { personId: true, amount: true } }),
      prisma.sale.findMany({
        where: { inventoryItemId: { not: null }, status: { not: 'CANCELLED' }, ...(createdAt ? { createdAt } : {}) },
        select: {
          id: true,
          parcelId: true,
          inventoryItemId: true,
          quantity: true,
          soldPrice: true,
          costPrice: true,
          receivedAmount: true,
          profit: true,
          status: true,
          paymentStatus: true,
          inventoryHeld: true,
        },
      }),
      prisma.person.findMany({ select: { id: true, name: true } }),
    ])
    const personName = new Map(people.map((p) => [p.id, p.name]))
    const r2 = (n: number) => Math.round(n * 100) / 100

    // Stock now
    const onHand = {
      units: items.reduce((a, i) => a + i.stockQty, 0),
      value: r2(items.reduce((a, i) => a + i.stockQty * i.avgCost, 0)),
      items: items.length,
      lowStock: items.filter((i) => i.lowStockAt != null && i.stockQty <= i.lowStockAt).length,
      outOfStock: items.filter((i) => i.stockQty <= 0).length,
    }

    // Bought in the period, by person
    const byPerson = new Map<string, { fromHand: number; fromSavings: number }>()
    for (const p of purchases) {
      for (const pay of p.payments) {
        const cur = byPerson.get(pay.personId) || { fromHand: 0, fromSavings: 0 }
        if (pay.kind === 'SAVINGS') cur.fromSavings += pay.amount
        else cur.fromHand += pay.amount
        byPerson.set(pay.personId, cur)
      }
    }
    const bought = {
      purchases: purchases.length,
      units: purchases.reduce((a, p) => a + p.quantity, 0),
      total: r2(purchases.reduce((a, p) => a + p.totalCost, 0)),
      byPerson: Array.from(byPerson.entries()).map(([id, v]) => ({ id, name: personName.get(id) || '?', fromHand: r2(v.fromHand), fromSavings: r2(v.fromSavings) })),
    }

    const investedMap = new Map<string, number>()
    for (const p of allSavings) investedMap.set(p.personId, (investedMap.get(p.personId) || 0) + p.amount)
    const invested = Array.from(investedMap.entries()).map(([id, amount]) => ({ id, name: personName.get(id) || '?', amount: r2(amount) }))

    // Sold from inventory in the period
    // (returned orders whose item did not come back are a loss: counted under "returned")
    const group = (list: typeof sales) => ({
      orders: countOrders(list),
      units: list.reduce((a, s) => a + s.quantity, 0),
      sales: r2(list.reduce((a, s) => a + s.soldPrice * s.quantity, 0)),
      cost: r2(list.reduce((a, s) => a + s.costPrice * s.quantity, 0)),
      grossProfit: r2(list.reduce((a, s) => a + (s.soldPrice - s.costPrice) * s.quantity, 0)),
    })
    const delivered = sales.filter((s) => s.status === 'DELIVERED')
    const inProgress = sales.filter((s) => s.status === 'PACKING' || s.status === 'DISPATCHED')
    const returned = sales.filter((s) => s.status === 'RETURNED')
    const sold = {
      delivered: { ...group(delivered), netProfit: r2(delivered.reduce((a, s) => a + s.profit, 0)) }, // after DC, petrol, GST, fees
      inProgress: group(inProgress),
      returned: {
        ...group(returned),
        itemsBack: returned.filter((s) => !s.inventoryHeld).reduce((a, s) => a + s.quantity, 0),
        itemsLost: returned.filter((s) => s.inventoryHeld).reduce((a, s) => a + s.quantity, 0),
        loss: r2(returned.reduce((a, s) => a + s.profit, 0)),
      },
    }

    // Per item
    const perItem = items
      .map((i) => {
        const mineSold = delivered.filter((s) => s.inventoryItemId === i.id)
        const mineOpen = inProgress.filter((s) => s.inventoryItemId === i.id)
        const mineBought = purchases.filter((p) => p.itemId === i.id)
        return {
          id: i.id,
          name: i.name,
          stockQty: i.stockQty,
          avgCost: i.avgCost,
          value: r2(i.stockQty * i.avgCost),
          lowStock: i.lowStockAt != null && i.stockQty <= i.lowStockAt,
          boughtUnits: mineBought.reduce((a, p) => a + p.quantity, 0),
          boughtTotal: r2(mineBought.reduce((a, p) => a + p.totalCost, 0)),
          soldUnits: mineSold.reduce((a, s) => a + s.quantity, 0),
          openUnits: mineOpen.reduce((a, s) => a + s.quantity, 0),
          sales: r2(mineSold.reduce((a, s) => a + s.soldPrice * s.quantity, 0)),
          profit: r2(mineSold.reduce((a, s) => a + s.profit, 0)),
        }
      })
      .sort((a, b) => b.sales - a.sales || b.value - a.value)

    return NextResponse.json({ onHand, bought, invested, sold, items: perItem })
  } catch (error: any) {
    console.error('Inventory summary error:', error)
    return NextResponse.json({ error: error.message || 'Could not load the inventory summary' }, { status: 500 })
  }
}
