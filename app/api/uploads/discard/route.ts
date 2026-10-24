import { NextRequest, NextResponse } from 'next/server'
import prisma from '@/lib/prisma'
import { destroyPhoto, isOurPhoto } from '@/lib/cloudinary'

// Removes a photo that was uploaded in the form but never saved on an order
export async function POST(request: NextRequest) {
  try {
    const { publicId } = await request.json()
    if (typeof publicId !== 'string' || !isOurPhoto(publicId)) {
      return NextResponse.json({ error: 'Invalid photo' }, { status: 400 })
    }
    // never delete a photo that belongs to a saved order through this route
    const saved = await prisma.orderImage.findFirst({ where: { publicId }, select: { id: true } })
    if (saved) return NextResponse.json({ error: 'Photo is saved on an order' }, { status: 409 })

    await destroyPhoto(publicId)
    return NextResponse.json({ success: true })
  } catch (error: any) {
    return NextResponse.json({ error: error.message || 'Failed to remove photo' }, { status: 500 })
  }
}
