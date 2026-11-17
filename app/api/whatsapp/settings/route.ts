import { NextRequest, NextResponse } from 'next/server'
import prisma from '@/lib/prisma'
import { isWhatsAppOn, setWhatsAppOn } from '@/lib/whatsapp'

export const dynamic = 'force-dynamic'

// WhatsApp switches: everything on / off, and on / off per order source (Daraz is off by default)
export async function GET() {
  try {
    const [enabled, sources] = await Promise.all([
      isWhatsAppOn(),
      prisma.orderSource.findMany({ orderBy: { name: 'asc' }, select: { id: true, name: true, whatsappEnabled: true } }),
    ])
    return NextResponse.json({ enabled, sources })
  } catch (error: any) {
    console.error('WhatsApp settings GET error:', error)
    return NextResponse.json({ error: error.message || 'Could not load WhatsApp settings' }, { status: 500 })
  }
}

// { enabled: boolean }                         → WhatsApp on / off for everything
// { sourceId: string, whatsappEnabled: boolean } → on / off for one order source
export async function PUT(request: NextRequest) {
  try {
    const body = (await request.json()) as { enabled?: unknown; sourceId?: unknown; whatsappEnabled?: unknown }

    if (typeof body.enabled === 'boolean') {
      await setWhatsAppOn(body.enabled)
      return NextResponse.json({ ok: true, enabled: body.enabled })
    }

    if (typeof body.sourceId === 'string' && typeof body.whatsappEnabled === 'boolean') {
      const src = await prisma.orderSource.update({
        where: { id: body.sourceId },
        data: { whatsappEnabled: body.whatsappEnabled },
        select: { id: true, name: true, whatsappEnabled: true },
      })
      return NextResponse.json({ ok: true, source: src })
    }

    return NextResponse.json({ error: 'Send { enabled } or { sourceId, whatsappEnabled }.' }, { status: 400 })
  } catch (error: any) {
    if (error?.code === 'P2025') return NextResponse.json({ error: 'Order source not found' }, { status: 404 })
    console.error('WhatsApp settings PUT error:', error)
    return NextResponse.json({ error: error.message || 'Could not save' }, { status: 500 })
  }
}
