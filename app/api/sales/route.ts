import { NextRequest, NextResponse } from 'next/server'
import { PrismaClient } from '@prisma/client'

const prisma = new PrismaClient()

export async function POST(request: NextRequest) {
  try {
    const body = await request.json()
    const { productName, customerName, address, cost, soldPrice } = body

    // Validate input
    if (!productName || !customerName || !address || !cost || !soldPrice) {
      return NextResponse.json(
        { error: 'All fields are required' },
        { status: 400 }
      )
    }

    const cost_num = parseFloat(cost)
    const soldPrice_num = parseFloat(soldPrice)
    const profit = soldPrice_num - cost_num

    const sale = await prisma.sale.create({
      data: {
        productName,
        customerName,
        address,
        cost: cost_num,
        soldPrice: soldPrice_num,
        profit,
      },
    })

    return NextResponse.json(sale, { status: 201 })
  } catch (error) {
    console.error('Error creating sale:', error)
    return NextResponse.json(
      { error: 'Failed to create sale' },
      { status: 500 }
    )
  }
}

export async function GET() {
  try {
    const sales = await prisma.sale.findMany({
      orderBy: {
        createdAt: 'desc',
      },
    })

    // Calculate totals
    const totalSales = sales.reduce((sum, sale) => sum + sale.soldPrice, 0)
    const totalProfit = sales.reduce((sum, sale) => sum + sale.profit, 0)

    return NextResponse.json({
      sales,
      totalSales,
      totalProfit,
      count: sales.length,
    })
  } catch (error) {
    console.error('Error fetching sales:', error)
    return NextResponse.json(
      { error: 'Failed to fetch sales' },
      { status: 500 }
    )
  }
}
