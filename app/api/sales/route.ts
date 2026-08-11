import { NextRequest, NextResponse } from 'next/server'
import prisma from '@/lib/prisma'
import { OrderStatus } from '@prisma/client'

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

    if (search) {
      where.OR = [
        { customerName: { contains: search, mode: 'insensitive' } },
        { productName: { contains: search, mode: 'insensitive' } },
        { city: { contains: search, mode: 'insensitive' } },
        { address: { contains: search, mode: 'insensitive' } },
      ]
    }

    if (range !== 'all') {
      const now = new Date()
      let dateFilter: any = null

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

      if (dateFilter) {
        where.createdAt = dateFilter
      }
    }

    const sales = await prisma.sale.findMany({
      where,
      orderBy: { createdAt: 'desc' },
      include: { product: true },
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
    } = body

    if (!productName || !customerName || !address || !city || costPrice === undefined || soldPrice === undefined) {
      return NextResponse.json({ error: 'Please provide all required order details.' }, { status: 400 })
    }

    const qty = parseInt(quantity, 10) || 1
    const cost_num = parseFloat(costPrice)
    const sold_num = parseFloat(soldPrice)
    const delivery_num = parseFloat(deliveryCharge) || 0

    // Auto-upsert City Delivery Rate
    if (city.trim() && delivery_num > 0) {
      await prisma.cityDeliveryRate.upsert({
        where: { cityName: city.trim() },
        update: { deliveryFee: delivery_num },
        create: { cityName: city.trim(), deliveryFee: delivery_num },
      })
    }

    // Default status is DISPATCHED. Profit realized = 0 while pending dispatch.
    const sale = await prisma.sale.create({
      data: {
        productId: productId || null,
        productName: productName.trim(),
        customerName: customerName.trim(),
        address: address.trim(),
        city: city.trim(),
        quantity: qty,
        costPrice: cost_num,
        soldPrice: sold_num,
        deliveryCharge: delivery_num,
        profit: 0,
        status: 'DISPATCHED',
        deductDeliveryOnReturn: Boolean(deductDeliveryOnReturn),
      },
    })

    return NextResponse.json(sale, { status: 201 })
  } catch (error: any) {
    console.error('Create sale error:', error)
    return NextResponse.json({ error: error.message || 'Failed to create sale' }, { status: 500 })
  }
}
