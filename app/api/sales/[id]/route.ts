import { NextRequest, NextResponse } from 'next/server'
import prisma from '@/lib/prisma'
import { OrderStatus, Sale } from '@prisma/client'
import { deliveredProfit, splitByWeight } from '@/lib/saleMoney'
import { destroyPhoto } from '@/lib/cloudinary'

// The order and, if it is part of a parcel, every product delivered / returned with it
const loadParcel = async (id: string): Promise<Sale[]> => {
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

// Changes the status of an order. A parcel always moves together (delivered / returned as one);
// a parcel's return loss is split across its products by sale value.
export async function PATCH(
  request: NextRequest,
  { params }: { params: { id: string } }
) {
  try {
    const body = await request.json()
    const { status, deductDeliveryOnReturn, returnLoss, coverReturned } = body as {
      status: OrderStatus
      deductDeliveryOnReturn?: boolean
      returnLoss?: number | string
      coverReturned?: boolean
    }

    const sales = await loadParcel(params.id)
    if (sales.length === 0) {
      return NextResponse.json({ error: 'Sale record not found' }, { status: 404 })
    }

    const targetStatus = status
    const lossNum = returnLoss !== undefined ? parseFloat(String(returnLoss)) : NaN
    const lossShares = isNaN(lossNum)
      ? null
      : splitByWeight(Math.max(0, lossNum), sales.map((s) => s.soldPrice * s.quantity))

    for (const sale of sales) await syncStock(sale, targetStatus)

    const updated = await prisma.$transaction(async (tx) => {
      const rows = []
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
            },
          })
        )
      }
      return rows
    })

    return NextResponse.json(updated.find((s) => s.id === params.id) ?? updated[0])
  } catch (error: any) {
    console.error('Update sale status error:', error)
    return NextResponse.json({ error: error.message || 'Failed to update sale' }, { status: 500 })
  }
}

// Deletes an order; a parcel is deleted as a whole
export async function DELETE(
  _request: NextRequest,
  { params }: { params: { id: string } }
) {
  try {
    const sales = await loadParcel(params.id)
    if (sales.length === 0) {
      return NextResponse.json({ error: 'Sale record not found' }, { status: 404 })
    }

    // Restore stock for delivered old-inventory orders
    for (const sale of sales) {
      if (sale.status === 'DELIVERED' && sale.productId) {
        await prisma.product.update({ where: { id: sale.productId }, data: { stockQty: { increment: sale.quantity } } })
      }
    }

    await prisma.$transaction(async (tx) => {
      for (const sale of sales) {
        // The cover this order took from returned stock goes back to returned stock
        if (sale.returnedItemId) {
          await tx.returnedItem.updateMany({
            where: { id: sale.returnedItemId, usedInSaleId: sale.id },
            data: { status: 'AVAILABLE', usedInSaleId: null },
          })
        }
        // Returned stock created by this order disappears with it (unless already reused)
        await tx.returnedItem.deleteMany({ where: { sourceSaleId: sale.id, status: 'AVAILABLE' } })
      }
      await tx.sale.deleteMany({ where: { id: { in: sales.map((s) => s.id) } } })
    })

    // The order's photos go with it (database + Cloudinary), unless another row still uses the number
    const orderNo = sales[0].orderNo
    if (orderNo != null && !(await prisma.sale.findFirst({ where: { orderNo }, select: { id: true } }))) {
      const photos = await prisma.orderImage.findMany({ where: { orderNo } })
      await prisma.orderImage.deleteMany({ where: { orderNo } })
      await Promise.all(photos.map((p) => destroyPhoto(p.publicId)))
    }

    return NextResponse.json({ success: true, deleted: sales.length })
  } catch (error: any) {
    console.error('Delete sale error:', error)
    return NextResponse.json({ error: error.message || 'Failed to delete sale' }, { status: 500 })
  }
}
