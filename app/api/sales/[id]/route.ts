import { NextRequest, NextResponse } from 'next/server'
import { PrismaClient } from '@prisma/client'

const prisma = new PrismaClient()

export async function DELETE(
  _request: NextRequest, // <--- TypeScript error se bachne ke liye underscore (_) lagaya hai
  { params }: { params: { id: string } }
) {
  try {
    const { id } = params

    await prisma.sale.delete({
      where: { id },
    })

    return NextResponse.json({ success: true })
  } catch (error) {
    console.error('Error deleting sale:', error)
    return NextResponse.json(
      { error: 'Failed to delete sale' },
      { status: 500 }
    )
  }
}