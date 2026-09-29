import { NextRequest, NextResponse } from 'next/server'
import prisma from '@/lib/prisma'

export async function PATCH(
  request: NextRequest,
  { params }: { params: { id: string } }
) {
  try {
    const { name } = await request.json()
    const trimmed = typeof name === 'string' ? name.trim() : ''

    if (!trimmed) {
      return NextResponse.json({ error: 'Category name is required' }, { status: 400 })
    }

    const duplicate = await prisma.category.findFirst({
      where: { name: { equals: trimmed, mode: 'insensitive' }, NOT: { id: params.id } },
    })
    if (duplicate) {
      return NextResponse.json({ error: 'A category with this name already exists' }, { status: 409 })
    }

    const category = await prisma.category.update({
      where: { id: params.id },
      data: { name: trimmed },
    })
    return NextResponse.json(category)
  } catch (error: any) {
    return NextResponse.json({ error: error.message || 'Failed to update category' }, { status: 500 })
  }
}

export async function DELETE(
  _request: NextRequest,
  { params }: { params: { id: string } }
) {
  try {
    // Sales and returned items keep existing; their categoryId is set to NULL (onDelete: SetNull)
    await prisma.category.delete({ where: { id: params.id } })
    return NextResponse.json({ success: true })
  } catch (error: any) {
    return NextResponse.json({ error: error.message || 'Failed to delete category' }, { status: 500 })
  }
}
