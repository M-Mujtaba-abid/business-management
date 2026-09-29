import { NextRequest, NextResponse } from 'next/server'
import prisma from '@/lib/prisma'

export const dynamic = 'force-dynamic'

export async function GET() {
  try {
    const sources = await prisma.orderSource.findMany({ orderBy: { name: 'asc' } })
    return NextResponse.json(sources)
  } catch (error: any) {
    return NextResponse.json({ error: error.message || 'Failed to fetch order sources' }, { status: 500 })
  }
}

export async function POST(request: NextRequest) {
  try {
    const { name } = await request.json()
    const trimmed = typeof name === 'string' ? name.trim() : ''

    if (!trimmed) {
      return NextResponse.json({ error: 'Name is required' }, { status: 400 })
    }

    // Return the existing source if the same name (any case) already exists
    const existing = await prisma.orderSource.findFirst({
      where: { name: { equals: trimmed, mode: 'insensitive' } },
    })
    if (existing) return NextResponse.json(existing)

    const source = await prisma.orderSource.create({ data: { name: trimmed } })
    return NextResponse.json(source, { status: 201 })
  } catch (error: any) {
    return NextResponse.json({ error: error.message || 'Failed to create order source' }, { status: 500 })
  }
}
