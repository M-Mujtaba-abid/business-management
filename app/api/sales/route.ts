import { NextRequest, NextResponse } from 'next/server'
import prisma from '@/lib/prisma'
import { OrderStatus, SupplierPayment, CustomerPayment } from '@prisma/client'
import { splitByWeight } from '@/lib/saleMoney'
import { cleanRef, nextOrderNo, findDuplicateRef, parseOrderDate, missingRequiredRef } from '@/lib/orderRefs'

export const dynamic = 'force-dynamic'

export async function GET(request: NextRequest) {
  try {
    const { searchParams } = new URL(request.url)
    const search = searchParams.get('search') || ''
    const status = searchParams.get('status') || 'ALL'
    const range = searchParams.get('range') || 'all'

    const where: any = {}

    if (status !== 'ALL') {
      where.status = status as OrderStatus
    }

    const categoryId = searchParams.get('categoryId')
    const supplierId = searchParams.get('supplierId')
    const supplierPayment = searchParams.get('supplierPayment')
    const olderThanDays = parseInt(searchParams.get('olderThanDays') || '', 10)
    const paymentSourceId = searchParams.get('paymentSourceId')
    const paymentStatus = searchParams.get('paymentStatus')
    const orderSourceId = searchParams.get('orderSourceId')
    const receivedById = searchParams.get('receivedById')

    if (categoryId) where.categoryId = categoryId
    if (supplierId) where.supplierId = supplierId
    if (supplierPayment === 'PENDING' || supplierPayment === 'PAID') {
      where.supplierPaymentStatus = supplierPayment as SupplierPayment
    }
    if (receivedById === 'none') where.receivedById = null
    else if (receivedById) where.receivedById = receivedById
    if (orderSourceId === 'none') where.orderSourceId = null
    else if (orderSourceId) where.orderSourceId = orderSourceId
    if (paymentSourceId === 'none') where.paymentSourceId = null
    else if (paymentSourceId) where.paymentSourceId = paymentSourceId
    if (paymentStatus === 'NOT_RECEIVED' || paymentStatus === 'RECEIVED') {
      where.paymentStatus = paymentStatus as CustomerPayment
    }
    // Orders with neither a Daraz / Website order ID nor a tracking number yet
    if (searchParams.get('missingRef') === '1') {
      where.externalOrderId = null
      where.trackingNumber = null
    }

    if (search) {
      where.OR = [
        { customerName: { contains: search, mode: 'insensitive' } },
        { productName: { contains: search, mode: 'insensitive' } },
        { city: { contains: search, mode: 'insensitive' } },
        { address: { contains: search, mode: 'insensitive' } },
        { supplier: { name: { contains: search, mode: 'insensitive' } } },
        { category: { name: { contains: search, mode: 'insensitive' } } },
        { paymentSource: { name: { contains: search, mode: 'insensitive' } } },
        { orderSource: { name: { contains: search, mode: 'insensitive' } } },
        { receivedBy: { name: { contains: search, mode: 'insensitive' } } },
        { externalOrderId: { contains: search.replace(/^#/, ''), mode: 'insensitive' } },
        { trackingNumber: { contains: search.replace(/^#/, ''), mode: 'insensitive' } },
      ]
      // "1045" or "#1045" also finds our own order number
      const asNumber = /^#?\d+$/.test(search.trim()) ? parseInt(search.trim().replace('#', ''), 10) : NaN
      if (!isNaN(asNumber)) where.OR.push({ orderNo: asNumber })
    }

    const startDate = searchParams.get('startDate')
    const endDate = searchParams.get('endDate')

    let dateFilter: any = {}

    if (startDate || endDate) {
      if (startDate) {
        const [sY, sM, sD] = startDate.split('-').map(Number)
        dateFilter.gte = new Date(sY, sM - 1, sD, 0, 0, 0, 0)
      }
      if (endDate) {
        const [eY, eM, eD] = endDate.split('-').map(Number)
        dateFilter.lte = new Date(eY, eM - 1, eD, 23, 59, 59, 999)
      }
    } else if (range !== 'all') {
      const now = new Date()

      if (range === 'today') {
        const startOfDay = new Date(now.getFullYear(), now.getMonth(), now.getDate(), 0, 0, 0, 0)
        const endOfDay = new Date(now.getFullYear(), now.getMonth(), now.getDate(), 23, 59, 59, 999)
        dateFilter = { gte: startOfDay, lte: endOfDay }
      } else if (range === 'week') {
        const startOfWeek = new Date(now)
        startOfWeek.setDate(now.getDate() - now.getDay())
        startOfWeek.setHours(0, 0, 0, 0)
        dateFilter = { gte: startOfWeek }
      } else if (range === 'month') {
        const startOfMonth = new Date(now.getFullYear(), now.getMonth(), 1, 0, 0, 0, 0)
        dateFilter = { gte: startOfMonth }
      } else if (/^\d{4}-\d{2}$/.test(range)) {
        const [yearStr, monthStr] = range.split('-')
        const year = parseInt(yearStr, 10)
        const month = parseInt(monthStr, 10) - 1
        const startOfMonth = new Date(year, month, 1, 0, 0, 0, 0)
        const endOfMonth = new Date(year, month + 1, 0, 23, 59, 59, 999)
        dateFilter = { gte: startOfMonth, lte: endOfMonth }
      } else if (/^\d{4}$/.test(range)) {
        const year = parseInt(range, 10)
        const startOfYear = new Date(year, 0, 1, 0, 0, 0, 0)
        const endOfYear = new Date(year, 11, 31, 23, 59, 59, 999)
        dateFilter = { gte: startOfYear, lte: endOfYear }
      }
    }

    // "Older than N days" (e.g. supplier payments pending for 15+ days)
    if (!isNaN(olderThanDays) && olderThanDays > 0) {
      const cutoff = new Date()
      cutoff.setDate(cutoff.getDate() - olderThanDays)
      if (!dateFilter.lte || dateFilter.lte > cutoff) dateFilter.lte = cutoff
    }

    if (dateFilter.gte || dateFilter.lte) {
      where.createdAt = dateFilter
    }

    const sales = await prisma.sale.findMany({
      where,
      orderBy: { createdAt: 'desc' },
      include: { product: true, category: true, supplier: true, paymentSource: true, orderSource: true, receivedBy: true },
    })

    return NextResponse.json(sales)
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
      expectedAmount,
      allowDuplicate,
    } = body
    const externalOrderId = cleanRef(body.externalOrderId)
    const trackingNumber = cleanRef(body.trackingNumber)
    // When the order was taken (defaults to now); can be set to an earlier date
    const orderDate = parseOrderDate(body.orderDate)
    if (typeof orderDate === 'string') return NextResponse.json({ error: orderDate }, { status: 400 })

    // Daraz orders need the Daraz order ID, Website orders the Leopards tracking number
    const missingRef = await missingRequiredRef(prisma, orderSourceId, { externalOrderId, trackingNumber })
    if (missingRef) return NextResponse.json({ error: missingRef }, { status: 400 })

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

    const items: {
      productId: string | null
      productName: string
      quantity: number
      costPrice: number
      soldPrice: number
      categoryId: string | null
      supplierId: string | null
      returnedItemId: string | null
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
        supplierPaid: it.supplierPaymentStatus === 'PAID',
      })
    }

    const returnedIds = items.map((i) => i.returnedItemId).filter(Boolean) as string[]
    if (new Set(returnedIds).size !== returnedIds.length) {
      return NextResponse.json({ error: 'The same returned item is used twice.' }, { status: 400 })
    }

    const delivery_num = parseFloat(deliveryCharge) || 0
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
        const supplierStatus = it.returnedItemId ? 'NOT_APPLICABLE' : it.supplierPaid ? 'PAID' : 'PENDING'
        const saleTotal = it.soldPrice * it.quantity
        const payout = payoutShares ? payoutShares[i] : null

        // Default status is DISPATCHED. Profit realized = 0 while pending dispatch.
        const row = await tx.sale.create({
          data: {
            productId: it.productId,
            productName: it.productName,
            customerName: customer,
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
            supplierPaymentStatus: supplierStatus,
            supplierPaidAt: supplierStatus === 'PAID' ? new Date() : null,
            paymentSourceId: paymentSourceId || null,
            orderSourceId: orderSourceId || null,
            receivedAmount: payout !== null && Math.abs(payout - saleTotal) >= 0.005 ? payout : null,
            receivedById: receivedById || null,
            parcelId,
            orderNo,
            externalOrderId,
            trackingNumber,
            ...(orderDate ? { createdAt: orderDate } : {}),
            paymentStatus: 'NOT_RECEIVED',
            profit: 0,
            status: 'DISPATCHED',
            deductDeliveryOnReturn: Boolean(deductDeliveryOnReturn),
          },
        })

        if (it.returnedItemId) {
          await tx.returnedItem.update({
            where: { id: it.returnedItemId },
            data: { status: 'USED', usedInSaleId: row.id },
          })
        }
        rows.push(row)
      }
      return rows
    })

    // Single product keeps the old response shape
    return NextResponse.json(created.length === 1 ? created[0] : { parcelId, sales: created }, { status: 201 })
  } catch (error: any) {
    console.error('Create sale error:', error)
    return NextResponse.json({ error: error.message || 'Failed to create sale' }, { status: 500 })
  }
}
