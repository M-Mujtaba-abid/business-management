import { NextRequest, NextResponse } from 'next/server'
import prisma from '@/lib/prisma'

export const dynamic = 'force-dynamic'

export async function GET(request: NextRequest) {
  try {
    const { searchParams } = new URL(request.url)
    const city = searchParams.get('city')

    if (city) {
      const cityRate = await prisma.cityDeliveryRate.findFirst({
        where: { cityName: { equals: city.trim(), mode: 'insensitive' } },
      })
      return NextResponse.json(cityRate || { deliveryFee: 0 })
    }

    const allCities = await prisma.cityDeliveryRate.findMany({
      orderBy: { cityName: 'asc' },
    })

    return NextResponse.json(allCities)
  } catch (error: any) {
    return NextResponse.json({ error: error.message || 'Failed to fetch city rate' }, { status: 500 })
  }
}

export async function POST(request: NextRequest) {
  try {
    const body = await request.json()
    const { cityName, deliveryFee } = body

    if (!cityName || deliveryFee === undefined) {
      return NextResponse.json({ error: 'City name and delivery fee are required' }, { status: 400 })
    }

    const fee = parseFloat(deliveryFee)

    const updatedCity = await prisma.cityDeliveryRate.upsert({
      where: { cityName: cityName.trim() },
      update: { deliveryFee: fee },
      create: { cityName: cityName.trim(), deliveryFee: fee },
    })

    return NextResponse.json(updatedCity)
  } catch (error: any) {
    return NextResponse.json({ error: error.message || 'Failed to update city delivery fee' }, { status: 500 })
  }
}
