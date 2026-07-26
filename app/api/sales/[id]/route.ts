import { NextRequest, NextResponse } from 'next/server'
import prisma from '@/lib/prisma'
import { OrderStatus } from '@prisma/client'

export async function PATCH(
  request: NextRequest,
  { params }: { params: { id: string } }
) {
  try {
    const { id } = params
    const body = await request.json()
    const { status, deductDeliveryOnReturn } = body as {
      status: OrderStatus
      deductDeliveryOnReturn?: boolean
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

    if (targetStatus === 'DELIVERED') {
      // Delivered: Cash realized. profit = (soldPrice - costPrice) * quantity
      calculatedProfit = (existingSale.soldPrice - existingSale.costPrice) * existingSale.quantity

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
      // Returned: If deductDeliveryOnReturn == true, profit = -deliveryCharge
      calculatedProfit = shouldDeductLoss ? -existingSale.deliveryCharge : 0

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

    const updatedSale = await prisma.sale.update({
      where: { id },
      data: {
        status: targetStatus,
        profit: calculatedProfit,
        deductDeliveryOnReturn: shouldDeductLoss,
      },
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

    await prisma.sale.delete({
      where: { id },
    })

    return NextResponse.json({ success: true })
  } catch (error: any) {
    console.error('Delete sale error:', error)
    return NextResponse.json({ error: error.message || 'Failed to delete sale' }, { status: 500 })
  }
}