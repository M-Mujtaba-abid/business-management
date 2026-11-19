import { NextRequest, NextResponse } from 'next/server'
import prisma from '@/lib/prisma'
import { withBalanceGuard, balanceErrorResponse } from '@/lib/balanceGuard'
import { logOrder, requestActor, orderRef, rs, STATUS_WORDS } from '@/lib/orderLog'
import { OrderStatus } from '@prisma/client'
import { destroyPhoto } from '@/lib/cloudinary'
import { loadParcel, changeParcelStatus } from '@/lib/orderStatus'

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

    const updated = await changeParcelStatus(sales, {
      status,
      deductDeliveryOnReturn,
      returnLoss,
      coverReturned,
      actor: await requestActor(request),
    })
    return NextResponse.json(updated.find((s) => s.id === params.id) ?? updated[0])
  } catch (error: any) {
    console.error('Update sale status error:', error)
    return NextResponse.json({ error: error.message || 'Failed to update sale' }, { status: 500 })
  }
}

// Deletes an order; a parcel is deleted as a whole
export async function DELETE(
  request: NextRequest,
  { params }: { params: { id: string } }
) {
  try {
    const sales = await loadParcel(params.id)
    if (sales.length === 0) {
      return NextResponse.json({ error: 'Sale record not found' }, { status: 404 })
    }

    // Deleting a received order takes its money off the person; that cannot leave them below zero
    await withBalanceGuard(async (tx) => {
      for (const sale of sales) {
        // Restore stock for delivered old-inventory orders
        if (sale.status === 'DELIVERED' && sale.productId) {
          await tx.product.update({ where: { id: sale.productId }, data: { stockQty: { increment: sale.quantity } } })
        }
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

    // Order history (kept after the order is gone)
    const total = sales.reduce((a, s) => a + s.soldPrice * s.quantity, 0)
    await logOrder({
      ...orderRef(sales),
      action: 'deleted',
      message: `Order deleted: ${sales[0].customerName} · ${rs(total)} · was ${STATUS_WORDS[sales[0].status]}`,
      actor: await requestActor(request),
      details: {
        items: sales.map((s) => ({ product: s.productName, qty: s.quantity, price: s.soldPrice })),
        total,
        status: sales[0].status,
        payment: sales[0].paymentStatus,
      },
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
    const blocked = balanceErrorResponse(error)
    if (blocked) return NextResponse.json(blocked, { status: 400 })
    console.error('Delete sale error:', error)
    return NextResponse.json({ error: error.message || 'Failed to delete sale' }, { status: 500 })
  }
}
