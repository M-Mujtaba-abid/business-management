import { NextRequest, NextResponse } from 'next/server'
import prisma from '@/lib/prisma'
import { destroyPhoto } from '@/lib/cloudinary'
import { logOrder, requestActor } from '@/lib/orderLog'

// Remove a photo from an order (and from Cloudinary)
export async function DELETE(request: NextRequest, { params }: { params: { orderNo: string; id: string } }) {
  try {
    const image = await prisma.orderImage.findUnique({ where: { id: params.id } })
    if (!image || String(image.orderNo) !== params.orderNo) {
      return NextResponse.json({ error: 'Photo not found' }, { status: 404 })
    }
    await prisma.orderImage.delete({ where: { id: image.id } })
    await destroyPhoto(image.publicId)
    await logOrder({ orderNo: image.orderNo, action: 'photo', message: 'Photo removed', actor: await requestActor(request) })
    return NextResponse.json({ success: true })
  } catch (error: any) {
    return NextResponse.json({ error: error.message || 'Failed to delete photo' }, { status: 500 })
  }
}
