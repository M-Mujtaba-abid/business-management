import { NextRequest, NextResponse } from 'next/server'
import prisma from '@/lib/prisma'
import { OrderStatus } from '@prisma/client'
import { deliveredProfit } from '@/lib/saleMoney'

export async function PATCH(
  request: NextRequest,
  { params }: { params: { id: string } }
) {
  try {
    const { id } = params
    const body = await request.json()
    const { status, deductDeliveryOnReturn, returnLoss, coverReturned } = body as {
      status: OrderStatus
      deductDeliveryOnReturn?: boolean
      returnLoss?: number | string
      coverReturned?: boolean
    }

    const existingSale = await prisma.sale.findUnique({
      where: { id },
    })

    if (!existingSale) {
      return NextResponse.json({ error: 'Sale record not found' }, { status: 404 })
    }

    const prevStatus = existingSale.status
    const targetStatus = status
    const shouldDeductLoss =
      deductDeliveryOnReturn !== undefined
        ? deductDeliveryOnReturn
        : existingSale.deductDeliveryOnReturn

    let calculatedProfit = 0
    let savedReturnLoss = 0

    if (targetStatus === 'DELIVERED') {
      // Delivered: payout (sale, or the edited received amount) - cover cost - DC - petrol - GST
      calculatedProfit = deliveredProfit(existingSale)

      // Stock deduction if moving to DELIVERED from non-DELIVERED
      if (prevStatus !== 'DELIVERED' && existingSale.productId) {
        await prisma.product.update({
          where: { id: existingSale.productId },
          data: {
            stockQty: {
              decrement: existingSale.quantity,
            },
          },
        })
      }
    } else if (targetStatus === 'RETURNED') {
      // Returned: loss entered by the user (DC, petrol, damaged cover...). Falls back to the
      // old behaviour (delivery charge as loss) when no amount is sent.
      const lossNum = returnLoss !== undefined ? parseFloat(String(returnLoss)) : NaN
      savedReturnLoss = !isNaN(lossNum)
        ? Math.max(0, lossNum)
        : shouldDeductLoss
        ? existingSale.deliveryCharge
        : 0
      calculatedProfit = -savedReturnLoss

      // Replenish stock if moving from DELIVERED to RETURNED
      if (prevStatus === 'DELIVERED' && existingSale.productId) {
        await prisma.product.update({
          where: { id: existingSale.productId },
          data: {
            stockQty: {
              increment: existingSale.quantity,
            },
          },
        })
      }
    } else {
      // DISPATCHED or CANCELLED
      calculatedProfit = 0

      // Replenish stock if moving from DELIVERED back to DISPATCHED or CANCELLED
      if (prevStatus === 'DELIVERED' && existingSale.productId) {
        await prisma.product.update({
          where: { id: existingSale.productId },
          data: {
            stockQty: {
              increment: existingSale.quantity,
            },
          },
        })
      }
    }

    const updatedSale = await prisma.$transaction(async (tx) => {
      // Leaving RETURNED: drop the returned-stock entry it created (if not already reused)
      if (prevStatus === 'RETURNED' && targetStatus !== 'RETURNED') {
        await tx.returnedItem.deleteMany({
          where: { sourceSaleId: id, status: 'AVAILABLE' },
        })
      }

      // Entering RETURNED with the cover back in hand: add it to returned stock
      if (targetStatus === 'RETURNED' && prevStatus !== 'RETURNED' && coverReturned) {
        await tx.returnedItem.create({
          data: {
            productName: existingSale.productName,
            categoryId: existingSale.categoryId,
            costPrice: existingSale.costPrice,
            quantity: existingSale.quantity,
            sourceSaleId: id,
          },
        })
      }

      return tx.sale.update({
        where: { id },
        data: {
          status: targetStatus,
          profit: calculatedProfit,
          returnLoss: savedReturnLoss,
          deductDeliveryOnReturn: shouldDeductLoss,
        },
      })
    })

    return NextResponse.json(updatedSale)
  } catch (error: any) {
    console.error('Update sale status error:', error)
    return NextResponse.json({ error: error.message || 'Failed to update sale' }, { status: 500 })
  }
}

export async function DELETE(
  _request: NextRequest,
  { params }: { params: { id: string } }
) {
  try {
    const { id } = params

    const existingSale = await prisma.sale.findUnique({
      where: { id },
    })

    if (!existingSale) {
      return NextResponse.json({ error: 'Sale record not found' }, { status: 404 })
    }

    // Restore stock if it was marked DELIVERED
    if (existingSale.status === 'DELIVERED' && existingSale.productId) {
      await prisma.product.update({
        where: { id: existingSale.productId },
        data: {
          stockQty: {
            increment: existingSale.quantity,
          },
        },
      })
    }

    await prisma.$transaction(async (tx) => {
      // The cover this order took from returned stock goes back to returned stock
      if (existingSale.returnedItemId) {
        await tx.returnedItem.updateMany({
          where: { id: existingSale.returnedItemId, usedInSaleId: id },
          data: { status: 'AVAILABLE', usedInSaleId: null },
        })
      }

      // Returned stock created by this order disappears with it (unless already reused)
      await tx.returnedItem.deleteMany({
        where: { sourceSaleId: id, status: 'AVAILABLE' },
      })

      await tx.sale.delete({
        where: { id },
      })
    })

    return NextResponse.json({ success: true })
  } catch (error: any) {
    console.error('Delete sale error:', error)
    return NextResponse.json({ error: error.message || 'Failed to delete sale' }, { status: 500 })
  }
}
