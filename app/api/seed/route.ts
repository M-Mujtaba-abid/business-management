import { NextResponse } from 'next/server'
import prisma from '@/lib/prisma'

export const dynamic = 'force-dynamic'

export async function GET() {
  try {
    // Seed Partners
    const partners = ['Noman', 'Mujtaba']
    for (const name of partners) {
      const existing = await prisma.partner.findFirst({ where: { name } })
      if (!existing) {
        await prisma.partner.create({ data: { name } })
      }
    }

    // Seed Sample Products if empty
    const productCount = await prisma.product.count()
    if (productCount === 0) {
      await prisma.product.createMany({
        data: [
          { name: 'Waterproof Top Cover', costPrice: 1200, salePrice: 2200, stockQty: 25 },
          { name: 'Heavy Duty Car Cover', costPrice: 2500, salePrice: 4200, stockQty: 15 },
          { name: 'Bike Premium Cover', costPrice: 600, salePrice: 1200, stockQty: 40 },
        ],
      })
    }

    // Seed Sample Cities if empty
    const cityCount = await prisma.cityDeliveryRate.count()
    if (cityCount === 0) {
      await prisma.cityDeliveryRate.createMany({
        data: [
          { cityName: 'Lahore', deliveryFee: 250 },
          { cityName: 'Karachi', deliveryFee: 300 },
          { cityName: 'Islamabad', deliveryFee: 250 },
          { cityName: 'Rawalpindi', deliveryFee: 250 },
          { cityName: 'Faisalabad', deliveryFee: 250 },
          { cityName: 'Multan', deliveryFee: 280 },
          { cityName: 'Peshawar', deliveryFee: 300 },
          { cityName: 'Sialkot', deliveryFee: 250 },
          { cityName: 'Gujranwala', deliveryFee: 250 },
          { cityName: 'Quetta', deliveryFee: 350 },
        ],
      })
    }

    return NextResponse.json({ success: true, message: 'Database seeded successfully' })
  } catch (error: any) {
    console.error('Seed error:', error)
    return NextResponse.json({ error: error.message || 'Failed to seed' }, { status: 500 })
  }
}
