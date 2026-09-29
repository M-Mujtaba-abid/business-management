import { NextRequest, NextResponse } from 'next/server'
import prisma from '@/lib/prisma'

export const dynamic = 'force-dynamic'

export async function GET() {
  try {
    const categories = await prisma.category.findMany({
      orderBy: { name: 'asc' },
      include: { _count: { select: { sales: true } } },
    })
    return NextResponse.json(categories)
  } catch (error: any) {
    return NextResponse.json({ error: error.message || 'Failed to fetch categories' }, { status: 500 })
  }
}

export async function POST(request: NextRequest) {
  try {
    const { name } = await request.json()
    const trimmed = typeof name === 'string' ? name.trim() : ''

    if (!trimmed) {
      return NextResponse.json({ error: 'Category name is required' }, { status: 400 })
    }

    // Return the existing category if the same name (any case) already exists
    const existing = await prisma.category.findFirst({
      where: { name: { equals: trimmed, mode: 'insensitive' } },
    })
    if (existing) return NextResponse.json(existing)

    const category = await prisma.category.create({ data: { name: trimmed } })
    return NextResponse.json(category, { status: 201 })
  } catch (error: any) {
    return NextResponse.json({ error: error.message || 'Failed to create category' }, { status: 500 })
  }
}
