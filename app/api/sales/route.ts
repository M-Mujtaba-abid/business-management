import { NextRequest, NextResponse } from 'next/server'
import prisma from '@/lib/prisma'
import { OrderStatus } from '@prisma/client'
import { salesWhere } from '@/lib/salesFilters'
import { splitByWeight, deliveredProfit } from '@/lib/saleMoney'
import { parseImages } from '@/lib/orderImages'
import { cleanRef, nextOrderNo, findDuplicateRef, parseOrderDate, missingRequiredRef, cleanPhone } from '@/lib/orderRefs'
import { notifyOrder, kindForStatus, whatsappByOrder } from '@/lib/whatsapp'
import { logOrder, requestActor, nameMaps, orderRef, rs, STATUS_WORDS } from '@/lib/orderLog'
import { holdStock, inventoryErrorResponse } from '@/lib/inventory'
import { resolveSupplierPayer } from '@/lib/supplierPayer'

export const dynamic = 'force-dynamic'

export async function GET(request: NextRequest) {
  try {
    const { searchParams } = new URL(request.url)
    const where = salesWhere(searchParams)

    const sales = await prisma.sale.findMany({
      where,
      orderBy: { createdAt: 'desc' },
      include: { product: true, category: true, supplier: true, paymentSource: true, orderSource: true, receivedBy: true, dcPaidBy: true },
    })

    // How many photos each order has + first photo URL for thumbnail.
    // A failure here only hides the photo counts; the orders list must still load.
    const countByOrder = new Map<number, number>()
    const thumbByOrder = new Map<number, string>()
    const orderNos = Array.from(new Set(sales.map((s) => s.orderNo).filter((n): n is number => n != null)))
    if (orderNos.length) {
      try {
        const photoCounts = await prisma.orderImage.groupBy({
          by: ['orderNo'],
          where: { orderNo: { in: orderNos } },
          _count: { _all: true },
        })
        photoCounts.forEach((p) => countByOrder.set(p.orderNo, p._count._all))

        // Fetch the first (oldest) photo per order for thumbnails
        const firstPhotos = await prisma.orderImage.findMany({
          where: { orderNo: { in: orderNos } },
          orderBy: { createdAt: 'asc' },
          distinct: ['orderNo'],
          select: { orderNo: true, url: true },
        })
        firstPhotos.forEach((p) => thumbByOrder.set(p.orderNo, p.url))
      } catch (err) {
        console.error('Photo counts unavailable:', err)
      }
    }

    // WhatsApp messages sent for each order (confirm / dispatched / delivered).
    // Like photos, a failure here only hides the WhatsApp icons.
    let waByOrder: Awaited<ReturnType<typeof whatsappByOrder>> = new Map()
    try {
      waByOrder = await whatsappByOrder(orderNos)
    } catch (err) {
      console.error('WhatsApp statuses unavailable:', err)
    }

    return NextResponse.json(sales.map(({ courierSlipUrl, ...s }) => ({
      ...s,
      // the Leopards slip link stays on the server (/api/sales/[id]/leopards/slip)
      hasLeopardsSlip: Boolean(courierSlipUrl),
      imageCount: (s.orderNo != null && countByOrder.get(s.orderNo)) || 0,
      imageUrl: (s.orderNo != null && thumbByOrder.get(s.orderNo)) || null,
      whatsapp: (s.orderNo != null && waByOrder.get(s.orderNo)) || [],
    })))
  } catch (error: any) {
    console.error('Fetch sales error:', error)
    return NextResponse.json({ error: error.message || 'Failed to fetch sales' }, { status: 500 })
  }
}

interface ItemInput {
  productId?: string | null
  productName?: string
  quantity?: number | string
  costPrice?: number | string
  soldPrice?: number | string
  categoryId?: string | null
  supplierId?: string | null
  returnedItemId?: string | null
  inventoryItemId?: string | null // sold from our own stock
  supplierPaymentStatus?: 'PAID' | 'PENDING'
}

const num = (v: unknown) => (v === undefined || v === null || v === '' ? NaN : parseFloat(String(v)))

// Creates an order. Accepts one product (fields on the body) or a parcel of products (`items`).
// A parcel's products share a parcelId; its DC / petrol / GST and expected payout are split
// across the products in proportion to each product's sale total.
export async function POST(request: NextRequest) {
  try {
    const body = await request.json()
    const {
      customerName,
      address,
      city,
      deliveryCharge = 0,
      deductDeliveryOnReturn = true,
      petrolCost = 0,
      gstAmount = 0,
      paymentSourceId,
      orderSourceId,
      receivedById,
      dcPaidById,
      expectedAmount,
      allowDuplicate,
    } = body
    const externalOrderId = cleanRef(body.externalOrderId)
    const trackingNumber = cleanRef(body.trackingNumber)
    // A new order starts as Packing, or Dispatched if it already left
    // New orders start as Packing; Dispatched / Delivered when the parcel already went out
    const startStatus: OrderStatus =
      body.status === 'DISPATCHED' || body.status === 'DELIVERED' ? body.status : 'PACKING'
    // When the order was taken (defaults to now); can be set to an earlier date
    const orderDate = parseOrderDate(body.orderDate)
    if (typeof orderDate === 'string') return NextResponse.json({ error: orderDate }, { status: 400 })

    // Daraz orders need the Daraz order ID, Website orders the Leopards tracking number
    const missingRef = await missingRequiredRef(prisma, orderSourceId, { externalOrderId, trackingNumber })
    if (missingRef) return NextResponse.json({ error: missingRef }, { status: 400 })

    // Optional photos (already uploaded to Cloudinary by the browser)
    const parsedImages = parseImages(body.images)
    if ('error' in parsedImages) return NextResponse.json({ error: parsedImages.error }, { status: 400 })

    // Same order ID / tracking already saved: ask before saving it twice
    if (!allowDuplicate) {
      const duplicate = await findDuplicateRef(prisma, { externalOrderId, trackingNumber })
      if (duplicate) return NextResponse.json({ error: duplicate, duplicate: true }, { status: 409 })
    }

    const rawItems: ItemInput[] = Array.isArray(body.items) && body.items.length > 0 ? body.items : [body]

    // Customer details are required on every order
    const customer = (customerName || '').trim()
    const addr = (address || '').trim()
    const cityName = (city || '').trim()
    if (!customer || !cityName || !addr) {
      return NextResponse.json({ error: 'Customer name, city and address are required.' }, { status: 400 })
    }
    const customerPhone = cleanPhone(body.customerPhone)
    if (!customerPhone) {
      return NextResponse.json({ error: 'Enter a valid customer phone number (e.g. 0300 1234567).' }, { status: 400 })
    }

    const items: {
      productId: string | null
      productName: string
      quantity: number
      costPrice: number
      soldPrice: number
      categoryId: string | null
      supplierId: string | null
      returnedItemId: string | null
      inventoryItemId: string | null
      supplierPaid: boolean
    }[] = []
    for (const [i, it] of rawItems.entries()) {
      const name = String(it.productName || '').trim()
      const cost = num(it.costPrice)
      const sold = num(it.soldPrice)
      const label = rawItems.length > 1 ? `Product ${i + 1}: ` : ''
      if (!name || isNaN(cost) || isNaN(sold)) {
        return NextResponse.json({ error: `${label}product name, buy price and sale price are required.` }, { status: 400 })
      }
      items.push({
        productId: it.productId || null,
        productName: name,
        quantity: parseInt(String(it.quantity ?? 1), 10) || 1,
        costPrice: cost,
        soldPrice: sold,
        categoryId: it.categoryId || null,
        supplierId: it.supplierId || null,
        returnedItemId: it.returnedItemId || null,
        inventoryItemId: it.returnedItemId ? null : it.inventoryItemId || null,
        supplierPaid: it.supplierPaymentStatus === 'PAID',
      })
    }

    // From inventory: the buy price is the item's average cost (set here, not by the form)
    for (const it of items) {
      if (!it.inventoryItemId) continue
      const inv = await prisma.inventoryItem.findUnique({ where: { id: it.inventoryItemId }, select: { avgCost: true, active: true, stockQty: true, name: true } })
      if (!inv || !inv.active) return NextResponse.json({ error: 'An inventory item you picked is not available any more.' }, { status: 400 })
      it.costPrice = inv.avgCost
      it.supplierId = null
    }

    const returnedIds = items.map((i) => i.returnedItemId).filter(Boolean) as string[]
    if (new Set(returnedIds).size !== returnedIds.length) {
      return NextResponse.json({ error: 'The same returned item is used twice.' }, { status: 400 })
    }

    const delivery_num = parseFloat(deliveryCharge) || 0
    // A paid DC must say whose account it came out of
    if (delivery_num > 0 && !dcPaidById) {
      return NextResponse.json({ error: 'Select whose account the delivery charge (DC) was paid from.' }, { status: 400 })
    }
    const weights = items.map((i) => i.soldPrice * i.quantity)
    const dcShares = splitByWeight(delivery_num, weights)
    const petrolShares = splitByWeight(parseFloat(petrolCost) || 0, weights)
    const gstShares = splitByWeight(parseFloat(gstAmount) || 0, weights)
    const expected = num(expectedAmount)
    // Expected payout if it differs from the sale (e.g. Daraz / courier cuts); blank = full sale
    const payoutShares = isNaN(expected) ? null : splitByWeight(expected, weights)
    const parcelId = items.length > 1 ? `parcel_${Date.now().toString(36)}${Math.random().toString(36).slice(2, 8)}` : null

    // Auto-upsert City Delivery Rate
    if (cityName !== 'General' && delivery_num > 0) {
      await prisma.cityDeliveryRate.upsert({
        where: { cityName },
        update: { deliveryFee: delivery_num },
        create: { cityName, deliveryFee: delivery_num },
      })
    }

    const actor = await requestActor(request)
    const supplierPayer = await resolveSupplierPayer(body.supplierPaidById)
    const created = await prisma.$transaction(async (tx) => {
      // One number for the whole order / parcel
      const orderNo = await nextOrderNo(tx)

      // A cover taken from returned stock was already paid for on its original order
      for (const id of returnedIds) {
        const item = await tx.returnedItem.findUnique({ where: { id } })
        if (!item || item.status !== 'AVAILABLE') {
          throw new Error('A returned item you picked is no longer available.')
        }
      }

      const rows = []
      for (const [i, it] of items.entries()) {
        // Returned stock and our own inventory were paid for already: no supplier to pay
        const supplierStatus = it.returnedItemId || it.inventoryItemId ? 'NOT_APPLICABLE' : it.supplierPaid ? 'PAID' : 'PENDING'
        const saleTotal = it.soldPrice * it.quantity
        const payout = payoutShares ? payoutShares[i] : null

        // Starts as Packing (or Dispatched). Profit realized = 0 until delivered;
        // an order added as already Delivered gets its profit right away.
        const receivedAmount = payout !== null && Math.abs(payout - saleTotal) >= 0.005 ? payout : null
        const profit =
          startStatus === 'DELIVERED'
            ? deliveredProfit({
                soldPrice: it.soldPrice,
                quantity: it.quantity,
                receivedAmount,
                costPrice: it.costPrice,
                deliveryCharge: dcShares[i],
                petrolCost: petrolShares[i],
                gstAmount: gstShares[i],
              })
            : 0
        const row = await tx.sale.create({
          data: {
            productId: it.productId,
            productName: it.productName,
            customerName: customer,
            customerPhone,
            address: addr,
            city: cityName,
            quantity: it.quantity,
            costPrice: it.costPrice,
            soldPrice: it.soldPrice,
            deliveryCharge: dcShares[i],
            petrolCost: petrolShares[i],
            gstAmount: gstShares[i],
            categoryId: it.categoryId,
            supplierId: it.returnedItemId ? null : it.supplierId,
            returnedItemId: it.returnedItemId,
            inventoryItemId: it.inventoryItemId,
            supplierPaymentStatus: supplierStatus,
            supplierPaidAt: supplierStatus === 'PAID' ? new Date() : null,
            // the supplier was paid when the order was saved: by the default payer (Mujtaba) unless chosen
            supplierPaidById: supplierStatus === 'PAID' ? supplierPayer : null,
            paymentSourceId: paymentSourceId || null,
            orderSourceId: orderSourceId || null,
            receivedAmount,
            receivedById: receivedById || null,
            dcPaidById: delivery_num > 0 ? dcPaidById : null,
            parcelId,
            orderNo,
            externalOrderId,
            trackingNumber,
            ...(orderDate ? { createdAt: orderDate } : {}),
            paymentStatus: 'NOT_RECEIVED',
            profit,
            status: startStatus,
            // Added as already delivered: the review follow-up starts now
            ...(startStatus === 'DELIVERED' ? { reviewStatus: 'PENDING' as const, reviewStatusAt: new Date() } : {}),
            deductDeliveryOnReturn: Boolean(deductDeliveryOnReturn),
          },
        })

        // Old inventory flow: a delivered order takes its product out of stock
        if (startStatus === 'DELIVERED' && it.productId) {
          await tx.product.update({ where: { id: it.productId }, data: { stockQty: { decrement: it.quantity } } })
        }

        if (it.returnedItemId) {
          await tx.returnedItem.update({
            where: { id: it.returnedItemId },
            data: { status: 'USED', usedInSaleId: row.id },
          })
        }
        rows.push(row)
      }

      // Our own stock: taken now (refuses the whole order if there is not enough)
      if (rows.some((r) => r.inventoryItemId)) {
        await holdStock(tx, rows, actor, { noteOrder: false })
        for (let i = 0; i < rows.length; i++) rows[i] = await tx.sale.findUniqueOrThrow({ where: { id: rows[i].id } })
      }

      if (parsedImages.images.length) {
        await tx.orderImage.createMany({
          data: parsedImages.images.map((img) => ({
            orderNo,
            url: img.url,
            publicId: img.publicId,
            width: img.width ?? null,
            height: img.height ?? null,
          })),
        })
      }
      return rows
    })

    // Order history: created (logged before the WhatsApp message, so it comes first)
    {
      const names = await nameMaps()
      const total = created.reduce((a, s) => a + s.soldPrice * s.quantity, 0)
      const lead = created[0]
      const fromStock = created.filter((s) => s.inventoryItemId)
      await logOrder({
        ...orderRef(created),
        action: 'created',
        message:
          `Order created: ${lead.customerName} · ${rs(total)} · ${STATUS_WORDS[startStatus]}` +
          (created.length > 1 ? ` · ${created.length} items` : '') +
          (fromStock.length ? ` · from inventory: ${fromStock.map((s) => `${s.quantity} × ${s.productName}`).join(', ')}` : ''),
        actor,
        details: {
          items: created.map((s) => ({
            product: s.productName,
            qty: s.quantity,
            price: s.soldPrice,
            cost: s.costPrice,
            ...(s.inventoryItemId ? { fromInventory: true } : {}),
          })),
          total,
          status: startStatus,
          customer: lead.customerName,
          phone: lead.customerPhone,
          city: lead.city,
          orderFrom: lead.orderSourceId ? names.sources.get(lead.orderSourceId) : null,
          paymentFrom: lead.paymentSourceId ? names.payments.get(lead.paymentSourceId) : null,
          receivedBy: lead.receivedById ? names.people.get(lead.receivedById) : null,
          deliveryCharge: delivery_num || 0,
          dcPaidBy: dcPaidById ? names.people.get(dcPaidById) : null,
          orderId: externalOrderId,
          tracking: trackingNumber,
        },
      })
    }

    // WhatsApp the customer (Packing → "confirm your order", Dispatched → "on its way",
    // Delivered → "delivered, please review").
    // Runs after the order is saved and never throws, so WhatsApp can't block an order.
    const waKind = kindForStatus(startStatus)
    if (waKind) await notifyOrder(created[0]?.orderNo, waKind)

    // Single product keeps the old response shape
    return NextResponse.json(created.length === 1 ? created[0] : { parcelId, sales: created }, { status: 201 })
  } catch (error: any) {
    const stock = inventoryErrorResponse(error)
    if (stock) return NextResponse.json(stock, { status: 400 })
    console.error('Create sale error:', error)
    return NextResponse.json({ error: error.message || 'Failed to create sale' }, { status: 500 })
  }
}
