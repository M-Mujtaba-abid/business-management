import { NextRequest, NextResponse } from 'next/server'
import prisma from '@/lib/prisma'

export const dynamic = 'force-dynamic'

export async function GET() {
  try {
    const people = await prisma.person.findMany({ orderBy: { name: 'asc' } })
    return NextResponse.json(people)
  } catch (error: any) {
    return NextResponse.json({ error: error.message || 'Failed to fetch people' }, { status: 500 })
  }
}

export async function POST(request: NextRequest) {
  try {
    const { name } = await request.json()
    const trimmed = typeof name === 'string' ? name.trim() : ''

    if (!trimmed) {
      return NextResponse.json({ error: 'Name is required' }, { status: 400 })
    }

    // Return the existing person if the same name (any case) already exists
    const existing = await prisma.person.findFirst({
      where: { name: { equals: trimmed, mode: 'insensitive' } },
    })
    if (existing) return NextResponse.json(existing)

    const person = await prisma.person.create({ data: { name: trimmed } })
    return NextResponse.json(person, { status: 201 })
  } catch (error: any) {
    return NextResponse.json({ error: error.message || 'Failed to create person' }, { status: 500 })
  }
}
