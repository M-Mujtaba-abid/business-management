import { NextRequest, NextResponse } from 'next/server'
import prisma from '@/lib/prisma'

export const dynamic = 'force-dynamic'

export async function GET() {
  try {
    const products = await prisma.product.findMany({
      orderBy: { name: 'asc' },
    })
    return NextResponse.json(products)
  } catch (error: any) {
    return NextResponse.json({ error: error.message || 'Failed to fetch products' }, { status: 500 })
  }
}

export async function POST(request: NextRequest) {
  try {
    const body = await request.json()
    const { name, costPrice, salePrice, stockQty = 0 } = body

    if (!name || costPrice === undefined || salePrice === undefined) {
      return NextResponse.json({ error: 'Name, cost price, and sale price are required.' }, { status: 400 })
    }

    const product = await prisma.product.create({
      data: {
        name: name.trim(),
        costPrice: parseFloat(costPrice),
        salePrice: parseFloat(salePrice),
        stockQty: parseInt(stockQty, 10) || 0,
      },
    })

    return NextResponse.json(product, { status: 201 })
  } catch (error: any) {
    console.error('Create product error:', error)
    return NextResponse.json({ error: error.message || 'Failed to create product' }, { status: 500 })
  }
}
