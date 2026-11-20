import type { Sale } from '@/components/OrderList'

// One row in the UI: a single-product order, or a parcel of products bought together
export interface OrderGroup {
  key: string
  lead: Sale // first product: carries the shared fields (status, payment, customer, sources...)
  items: Sale[]
  ids: string[]
  saleTotal: number
  costTotal: number
  profit: number
  payout: number // expected / received amount for the whole parcel
  hasPayoutEdit: boolean
  deliveryCharge: number
  petrolCost: number
  gstAmount: number
  supplierNames: string[]
  supplierPending: number // items whose supplier is not paid yet
  supplierTracked: number // items with supplier payment tracking (not returned stock / old orders)
}

const saleTotal = (s: Sale) => s.soldPrice * s.quantity

// Groups a list of sales into orders, keeping the list's order (first appearance of each parcel)
export function groupSales(sales: Sale[]): OrderGroup[] {
  const map = new Map<string, Sale[]>()
  for (const s of sales) {
    const key = s.parcelId || s.id
    const list = map.get(key)
    if (list) list.push(s)
    else map.set(key, [s])
  }

  return Array.from(map.entries()).map(([key, items]) => {
    const tracked = items.filter((i) => i.supplierPaymentStatus !== 'NOT_APPLICABLE')
    const names = items
      .map((i) => i.supplier?.name || (i.returnedItemId ? 'Returned stock' : i.inventoryItemId ? 'Inventory' : null))
      .filter(Boolean) as string[]
    return {
      key,
      lead: items[0],
      items,
      ids: items.map((i) => i.id),
      saleTotal: items.reduce((a, i) => a + saleTotal(i), 0),
      costTotal: items.reduce((a, i) => a + i.costPrice * i.quantity, 0),
      profit: items.reduce((a, i) => a + i.profit, 0),
      payout: items.reduce((a, i) => a + (i.receivedAmount ?? saleTotal(i)), 0),
      hasPayoutEdit: items.some((i) => i.receivedAmount != null),
      deliveryCharge: items.reduce((a, i) => a + i.deliveryCharge, 0),
      petrolCost: items.reduce((a, i) => a + (i.petrolCost || 0), 0),
      gstAmount: items.reduce((a, i) => a + (i.gstAmount || 0), 0),
      supplierNames: Array.from(new Set(names)),
      supplierPending: tracked.filter((i) => i.supplierPaymentStatus === 'PENDING').length,
      supplierTracked: tracked.length,
    }
  })
}

// A parcel shown as one sale, for popups that take a single order (return, payment received)
export function groupAsSale(g: OrderGroup): Sale {
  if (g.items.length === 1) return g.lead
  return {
    ...g.lead,
    productName: `${g.items.length} items: ${g.items.map((i) => i.productName).join(', ')}`,
    quantity: 1,
    soldPrice: g.saleTotal,
    costPrice: g.costTotal,
    deliveryCharge: g.deliveryCharge,
    petrolCost: g.petrolCost,
    gstAmount: g.gstAmount,
    profit: g.profit,
    receivedAmount: g.hasPayoutEdit ? g.payout : null,
  }
}
