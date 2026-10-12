// One place for order money maths, shared by the API routes.

interface SaleAmounts {
  soldPrice: number
  costPrice: number
  quantity: number
  deliveryCharge: number
  petrolCost: number
  gstAmount: number
  receivedAmount: number | null
}

// What the customer was charged for the order
export const saleTotal = (s: { soldPrice: number; quantity: number }) => s.soldPrice * s.quantity

// What actually lands (or is expected to land) in our account: the edited amount, else the full sale
export const payoutAmount = (s: { soldPrice: number; quantity: number; receivedAmount: number | null }) =>
  s.receivedAmount ?? saleTotal(s)

// Tax / fee cut by Daraz, the courier, etc. (negative if they paid more than the sale)
export const paymentFee = (s: { soldPrice: number; quantity: number; receivedAmount: number | null }) =>
  saleTotal(s) - payoutAmount(s)

// Profit once delivered: payout - cover cost - DC - petrol - GST
export const deliveredProfit = (s: SaleAmounts) =>
  payoutAmount(s) - s.costPrice * s.quantity - s.deliveryCharge - s.petrolCost - s.gstAmount

// Split a parcel-level amount (DC, petrol, GST, payout, return loss) across its products,
// in proportion to each product's sale total. Rounded to paisa; the last share takes the remainder.
export const splitByWeight = (total: number, weights: number[]): number[] => {
  if (weights.length === 0) return []
  const sum = weights.reduce((a, w) => a + w, 0)
  const shares = weights.map((w) => (sum > 0 ? w / sum : 1 / weights.length))
  const out = shares.map((s) => Math.round(total * s * 100) / 100)
  const drift = Math.round((total - out.reduce((a, v) => a + v, 0)) * 100) / 100
  out[out.length - 1] = Math.round((out[out.length - 1] + drift) * 100) / 100
  return out
}

// Number of orders in a list of products: a parcel's products count once
export const countOrders = (rows: { id: string; parcelId: string | null }[]) =>
  new Set(rows.map((r) => r.parcelId || r.id)).size
