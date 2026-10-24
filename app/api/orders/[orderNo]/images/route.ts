import { NextRequest, NextResponse } from 'next/server'
import prisma from '@/lib/prisma'
import { MAX_ORDER_PHOTOS } from '@/lib/cloudinary'
import { parseImages } from '@/lib/orderImages'

export const dynamic = 'force-dynamic'

const orderNoOf = (v: string) => {
  const n = parseInt(v, 10)
  return Number.isFinite(n) ? n : null
}

// Photos of one order
export async function GET(_request: NextRequest, { params }: { params: { orderNo: string } }) {
  const orderNo = orderNoOf(params.orderNo)
  if (orderNo === null) return NextResponse.json({ error: 'Invalid order number' }, { status: 400 })
  const images = await prisma.orderImage.findMany({ where: { orderNo }, orderBy: { createdAt: 'asc' } })
  return NextResponse.json(images)
}

// Add an uploaded photo to an order
export async function POST(request: NextRequest, { params }: { params: { orderNo: string } }) {
  try {
    const orderNo = orderNoOf(params.orderNo)
    if (orderNo === null) return NextResponse.json({ error: 'Invalid order number' }, { status: 400 })
    const order = await prisma.sale.findFirst({ where: { orderNo }, select: { id: true } })
    if (!order) return NextResponse.json({ error: 'Order not found' }, { status: 404 })

    const parsed = parseImages([await request.json()])
    if ('error' in parsed) return NextResponse.json({ error: parsed.error }, { status: 400 })

    const count = await prisma.orderImage.count({ where: { orderNo } })
    if (count >= MAX_ORDER_PHOTOS) {
      return NextResponse.json({ error: `An order can have at most ${MAX_ORDER_PHOTOS} photos.` }, { status: 400 })
    }
    const { url, publicId, width, height } = parsed.images[0]
    const image = await prisma.orderImage.create({ data: { orderNo, url, publicId, width, height } })
    return NextResponse.json(image, { status: 201 })
  } catch (error: any) {
    return NextResponse.json({ error: error.message || 'Failed to save photo' }, { status: 500 })
  }
}
