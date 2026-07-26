import { NextRequest, NextResponse } from 'next/server'
import prisma from '@/lib/prisma'

export const dynamic = 'force-dynamic'

export async function GET() {
  try {
    const suppliers = await prisma.supplier.findMany({
      orderBy: { name: 'asc' },
    })
    return NextResponse.json(suppliers)
  } catch (error: any) {
    return NextResponse.json({ error: error.message || 'Failed to fetch suppliers' }, { status: 500 })
  }
}

export async function POST(request: NextRequest) {
  try {
    const body = await request.json()
    const { name, phone, unpaidBalance = 0 } = body

    if (!name) {
      return NextResponse.json({ error: 'Supplier name is required' }, { status: 400 })
    }

    const supplier = await prisma.supplier.create({
      data: {
        name: name.trim(),
        phone: phone ? phone.trim() : null,
        unpaidBalance: parseFloat(unpaidBalance) || 0,
      },
    })

    return NextResponse.json(supplier, { status: 201 })
  } catch (error: any) {
    return NextResponse.json({ error: error.message || 'Failed to create supplier' }, { status: 500 })
  }
}
