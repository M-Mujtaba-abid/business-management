import { NextRequest, NextResponse } from 'next/server'
import prisma from '@/lib/prisma'
import { destroyPhoto } from '@/lib/cloudinary'

// Remove a photo from an order (and from Cloudinary)
export async function DELETE(_request: NextRequest, { params }: { params: { orderNo: string; id: string } }) {
  try {
    const image = await prisma.orderImage.findUnique({ where: { id: params.id } })
    if (!image || String(image.orderNo) !== params.orderNo) {
      return NextResponse.json({ error: 'Photo not found' }, { status: 404 })
    }
    await prisma.orderImage.delete({ where: { id: image.id } })
    await destroyPhoto(image.publicId)
    return NextResponse.json({ success: true })
  } catch (error: any) {
    return NextResponse.json({ error: error.message || 'Failed to delete photo' }, { status: 500 })
  }
}
