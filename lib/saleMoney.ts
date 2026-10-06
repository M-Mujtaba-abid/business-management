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
