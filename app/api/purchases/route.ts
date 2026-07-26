import { NextRequest, NextResponse } from 'next/server'
import prisma from '@/lib/prisma'
import { FundingSource } from '@prisma/client'

export const dynamic = 'force-dynamic'

export async function GET() {
  try {
    const purchases = await prisma.inventoryPurchase.findMany({
      orderBy: { createdAt: 'desc' },
      include: { product: true, partner: true, supplier: true },
    })
    return NextResponse.json(purchases)
  } catch (error: any) {
    return NextResponse.json({ error: error.message || 'Failed to fetch purchases' }, { status: 500 })
  }
}

export async function POST(request: NextRequest) {
  try {
    const body = await request.json()
    const { productId, quantity, unitCost, fundingSource, partnerId, supplierId } = body

    if (!productId || !quantity || unitCost === undefined || !fundingSource) {
      return NextResponse.json({ error: 'Product, quantity, unit cost, and funding source are required.' }, { status: 400 })
    }

    const qty = parseInt(quantity, 10)
    const cost = parseFloat(unitCost)
    if (isNaN(qty) || qty <= 0 || isNaN(cost) || cost < 0) {
      return NextResponse.json({ error: 'Please enter valid quantity and unit cost.' }, { status: 400 })
    }

    const totalCost = qty * cost

    const purchase = await prisma.inventoryPurchase.create({
      data: {
        productId,
        quantity: qty,
        unitCost: cost,
        totalCost,
        fundingSource: fundingSource as FundingSource,
        partnerId: fundingSource === 'PERSONAL_CAPITAL' && partnerId ? partnerId : null,
        supplierId: fundingSource === 'CREDIT_SUPPLIER' && supplierId ? supplierId : null,
      },
      include: { product: true, partner: true, supplier: true },
    })

    // Update Product stock & cost price
    await prisma.product.update({
      where: { id: productId },
      data: {
        stockQty: { increment: qty },
        costPrice: cost,
      },
    })

    // Update Partner Equity if Personal Capital
    if (fundingSource === 'PERSONAL_CAPITAL' && partnerId) {
      await prisma.partner.update({
        where: { id: partnerId },
        data: {
          totalCapitalInvested: { increment: totalCost },
        },
      })
    }

    // Update Supplier Unpaid Balance if Credit Supplier
    if (fundingSource === 'CREDIT_SUPPLIER' && supplierId) {
      await prisma.supplier.update({
        where: { id: supplierId },
        data: {
          unpaidBalance: { increment: totalCost },
        },
      })
    }

    return NextResponse.json(purchase, { status: 201 })
  } catch (error: any) {
    console.error('Create purchase error:', error)
    return NextResponse.json({ error: error.message || 'Failed to record inventory purchase' }, { status: 500 })
  }
}
