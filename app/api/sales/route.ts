import { NextRequest, NextResponse } from 'next/server'
import prisma from '@/lib/prisma'
import { OrderStatus, SupplierPayment, CustomerPayment } from '@prisma/client'

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
      ]
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

export async function POST(request: NextRequest) {
  try {
    const body = await request.json()
    const {
      productId,
      productName,
      customerName,
      address,
      city,
      quantity = 1,
      costPrice,
      soldPrice,
      deliveryCharge = 0,
      deductDeliveryOnReturn = true,
      categoryId,
      supplierId,
      petrolCost = 0,
      gstAmount = 0,
      returnedItemId,
      supplierPaymentStatus = 'PENDING',
      paymentSourceId,
      orderSourceId,
      receivedById,
    } = body

    // Customer details are optional in the quick order flow
    const customer = (customerName || '').trim() || 'Walk-in'
    const addr = (address || '').trim()
    const cityName = (city || '').trim() || 'General'

    if (!productName || !String(productName).trim() || costPrice === undefined || costPrice === '' || soldPrice === undefined || soldPrice === '') {
      return NextResponse.json({ error: 'Product name, cost price and sale price are required.' }, { status: 400 })
    }

    const qty = parseInt(quantity, 10) || 1
    const cost_num = parseFloat(costPrice)
    const sold_num = parseFloat(soldPrice)
    const delivery_num = parseFloat(deliveryCharge) || 0

    if (isNaN(cost_num) || isNaN(sold_num)) {
      return NextResponse.json({ error: 'Cost price and sale price must be numbers.' }, { status: 400 })
    }

    // Auto-upsert City Delivery Rate
    if (cityName !== 'General' && delivery_num > 0) {
      await prisma.cityDeliveryRate.upsert({
        where: { cityName },
        update: { deliveryFee: delivery_num },
        create: { cityName, deliveryFee: delivery_num },
      })
    }

    const sale = await prisma.$transaction(async (tx) => {
      // A cover taken from returned stock was already paid for on its original order
      if (returnedItemId) {
        const item = await tx.returnedItem.findUnique({ where: { id: returnedItemId } })
        if (!item || item.status !== 'AVAILABLE') {
          throw new Error('This returned item is no longer available.')
        }
      }

      const paymentStatus = returnedItemId
        ? 'NOT_APPLICABLE'
        : supplierPaymentStatus === 'PAID'
        ? 'PAID'
        : 'PENDING'

      // Default status is DISPATCHED. Profit realized = 0 while pending dispatch.
      const created = await tx.sale.create({
        data: {
          productId: productId || null,
          productName: String(productName).trim(),
          customerName: customer,
          address: addr,
          city: cityName,
          quantity: qty,
          costPrice: cost_num,
          soldPrice: sold_num,
          deliveryCharge: delivery_num,
          petrolCost: parseFloat(petrolCost) || 0,
          gstAmount: parseFloat(gstAmount) || 0,
          categoryId: categoryId || null,
          supplierId: returnedItemId ? null : supplierId || null,
          returnedItemId: returnedItemId || null,
          supplierPaymentStatus: paymentStatus,
          supplierPaidAt: paymentStatus === 'PAID' ? new Date() : null,
          paymentSourceId: paymentSourceId || null,
          orderSourceId: orderSourceId || null,
          receivedById: receivedById || null,
          paymentStatus: 'NOT_RECEIVED',
          profit: 0,
          status: 'DISPATCHED',
          deductDeliveryOnReturn: Boolean(deductDeliveryOnReturn),
        },
      })

      if (returnedItemId) {
        await tx.returnedItem.update({
          where: { id: returnedItemId },
          data: { status: 'USED', usedInSaleId: created.id },
        })
      }

      return created
    })

    return NextResponse.json(sale, { status: 201 })
  } catch (error: any) {
    console.error('Create sale error:', error)
    return NextResponse.json({ error: error.message || 'Failed to create sale' }, { status: 500 })
  }
}
