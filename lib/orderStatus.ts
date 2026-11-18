import prisma from '@/lib/prisma'
import type { OrderStatus, Sale } from '@prisma/client'
import { deliveredProfit, splitByWeight } from '@/lib/saleMoney'
import { notifyOrder, kindForStatus } from '@/lib/whatsapp'

// Changing an order's status, shared by the Orders page (PATCH /api/sales/[id]) and the
// Leopards status push (/api/leopards/push), so both do exactly the same thing.

// The order and, if it is part of a parcel, every product delivered / returned with it
export const loadParcel = async (id: string): Promise<Sale[]> => {
  const sale = await prisma.sale.findUnique({ where: { id } })
  if (!sale) return []
  if (!sale.parcelId) return [sale]
  return prisma.sale.findMany({ where: { parcelId: sale.parcelId }, orderBy: { createdAt: 'asc' } })
}

// Old inventory flow: keep product stock in step with delivered status
const syncStock = async (sale: Sale, target: OrderStatus) => {
  if (!sale.productId) return
  if (target === 'DELIVERED' && sale.status !== 'DELIVERED') {
    await prisma.product.update({ where: { id: sale.productId }, data: { stockQty: { decrement: sale.quantity } } })
  } else if (target !== 'DELIVERED' && sale.status === 'DELIVERED') {
    await prisma.product.update({ where: { id: sale.productId }, data: { stockQty: { increment: sale.quantity } } })
  }
}

export interface StatusChange {
  status: OrderStatus
  deductDeliveryOnReturn?: boolean
  returnLoss?: number | string
  coverReturned?: boolean
}

// Moves a whole parcel to the new status. A parcel's return loss is split across its products by
// sale value. Sends the customer's WhatsApp message when the status really changed.
export async function changeParcelStatus(sales: Sale[], change: StatusChange): Promise<Sale[]> {
  const { status: targetStatus, deductDeliveryOnReturn, returnLoss, coverReturned } = change
  const lossNum = returnLoss !== undefined ? parseFloat(String(returnLoss)) : NaN
  const lossShares = isNaN(lossNum)
    ? null
    : splitByWeight(Math.max(0, lossNum), sales.map((s) => s.soldPrice * s.quantity))

  for (const sale of sales) await syncStock(sale, targetStatus)

  const updated = await prisma.$transaction(async (tx) => {
    const rows: Sale[] = []
    for (const [i, sale] of sales.entries()) {
      const prevStatus = sale.status
      const shouldDeductLoss =
        deductDeliveryOnReturn !== undefined ? deductDeliveryOnReturn : sale.deductDeliveryOnReturn

      let profit = 0
      let savedReturnLoss = 0
      if (targetStatus === 'DELIVERED') {
        // payout (sale, or the edited received amount) - cover cost - DC - petrol - GST
        profit = deliveredProfit(sale)
      } else if (targetStatus === 'RETURNED') {
        // Loss entered by the user (DC, petrol, damaged cover...); falls back to the old
        // behaviour (delivery charge as loss) when no amount is sent.
        savedReturnLoss = lossShares ? lossShares[i] : shouldDeductLoss ? sale.deliveryCharge : 0
        profit = -savedReturnLoss
      }

      // Leaving RETURNED: drop the returned-stock entry it created (if not already reused)
      if (prevStatus === 'RETURNED' && targetStatus !== 'RETURNED') {
        await tx.returnedItem.deleteMany({ where: { sourceSaleId: sale.id, status: 'AVAILABLE' } })
      }

      // Entering RETURNED with the covers back in hand: add them to returned stock
      if (targetStatus === 'RETURNED' && prevStatus !== 'RETURNED' && coverReturned) {
        await tx.returnedItem.create({
          data: {
            productName: sale.productName,
            categoryId: sale.categoryId,
            costPrice: sale.costPrice,
            quantity: sale.quantity,
            sourceSaleId: sale.id,
          },
        })
      }

      rows.push(
        await tx.sale.update({
          where: { id: sale.id },
          data: {
            status: targetStatus,
            profit,
            returnLoss: savedReturnLoss,
            deductDeliveryOnReturn: shouldDeductLoss,
            // Marked Returned from the courier status: the parcel is still on its way back
            ...(targetStatus === 'RETURNED' && prevStatus !== 'RETURNED'
              ? { returnedAt: new Date(), returnReceived: false, returnReceivedAt: null }
              : {}),
            ...(targetStatus !== 'RETURNED' && prevStatus === 'RETURNED'
              ? { returnedAt: null, returnReceived: false, returnReceivedAt: null }
              : {}),
          },
        })
      )
    }
    return rows
  })

  // WhatsApp the customer when the order really moved to Packing / Dispatched / Delivered.
  // Each message is sent once per order, so moving back and forth never sends it twice.
  const waKind = sales[0].status !== targetStatus ? kindForStatus(targetStatus) : null
  if (waKind && sales[0].orderNo) await notifyOrder(sales[0].orderNo, waKind)

  return updated
}
