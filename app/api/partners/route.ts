import { NextRequest, NextResponse } from 'next/server'
import prisma from '@/lib/prisma'

export const dynamic = 'force-dynamic'

export async function GET() {
  try {
    const partners = await prisma.partner.findMany({
      orderBy: { name: 'asc' },
    })
    return NextResponse.json(partners)
  } catch (error: any) {
    return NextResponse.json({ error: error.message || 'Failed to fetch partners' }, { status: 500 })
  }
}

export async function POST(request: NextRequest) {
  try {
    const body = await request.json()
    const { name, totalCapitalInvested = 0 } = body

    if (!name) {
      return NextResponse.json({ error: 'Partner name is required' }, { status: 400 })
    }

    const partner = await prisma.partner.create({
      data: {
        name: name.trim(),
        totalCapitalInvested: parseFloat(totalCapitalInvested) || 0,
      },
    })

    return NextResponse.json(partner, { status: 201 })
  } catch (error: any) {
    return NextResponse.json({ error: error.message || 'Failed to create partner' }, { status: 500 })
  }
}
