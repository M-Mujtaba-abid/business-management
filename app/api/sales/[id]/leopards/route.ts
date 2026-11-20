import { NextRequest, NextResponse } from 'next/server'
import prisma from '@/lib/prisma'
import { loadParcel } from '@/lib/orderStatus'
import { bookPacket, cancelPacket, leopardsCities } from '@/lib/leopardsBooking'
import { logOrder, orderRef, requestActor, rs } from '@/lib/orderLog'
import { cleanPhone } from '@/lib/orderRefs'

export const dynamic = 'force-dynamic'
export const maxDuration = 60

const text = (v: unknown) => (typeof v === 'string' ? v.trim() : '')

// Book this order (whole parcel) with Leopards.
// POST { cityId, weightGrams, pieces, codAmount, instructions?, name?, phone?, phone2?, address? }
// Name / phone / address default to the order's. The tracking number is saved on the order.
export async function POST(request: NextRequest, { params }: { params: { id: string } }) {
  try {
    const sales = await loadParcel(params.id)
    if (!sales.length) return NextResponse.json({ error: 'Order not found' }, { status: 404 })
    const lead = sales[0]
    if (lead.trackingNumber) {
      return NextResponse.json({ error: `This order already has a tracking number (${lead.trackingNumber}).` }, { status: 409 })
    }
    if (lead.status === 'CANCELLED' || lead.status === 'RETURNED' || lead.status === 'DELIVERED') {
      return NextResponse.json({ error: 'Only a Packing or Dispatched order can be booked.' }, { status: 400 })
    }

    const body = await request.json().catch(() => ({}))
    const cityId = parseInt(String(body.cityId), 10)
    const cities = await leopardsCities()
    const city = cities.find((c) => c.id === cityId)
    if (!city) return NextResponse.json({ error: 'Pick the Leopards destination city.' }, { status: 400 })
    const weight = parseInt(String(body.weightGrams), 10)
    if (!(weight > 0)) return NextResponse.json({ error: 'Enter the weight in grams (e.g. 450).' }, { status: 400 })
    const pieces = parseInt(String(body.pieces ?? 1), 10) || 1
    const cod = parseFloat(String(body.codAmount))
    if (!Number.isFinite(cod) || cod < 0) return NextResponse.json({ error: 'Enter the cash to collect (0 if already paid).' }, { status: 400 })

    const name = text(body.name) || lead.customerName
    const phone = cleanPhone(text(body.phone) || lead.customerPhone)
    const address = text(body.address) || lead.address
    if (!phone) return NextResponse.json({ error: 'The customer phone number is missing.' }, { status: 400 })
    if (!address) return NextResponse.json({ error: 'The customer address is missing.' }, { status: 400 })

    const booked = await bookPacket({
      orderRef: lead.orderNo != null ? String(lead.orderNo) : lead.id,
      destinationCityId: city.id,
      consigneeName: name,
      consigneePhone: phone,
      consigneePhone2: cleanPhone(text(body.phone2)) || null,
      consigneeAddress: address,
      codAmount: cod,
      weightGrams: weight,
      pieces,
      instructions: text(body.instructions) || null,
    })

    const now = new Date()
    await prisma.sale.updateMany({
      where: { id: { in: sales.map((s) => s.id) } },
      data: { trackingNumber: booked.trackNumber, courierSlipUrl: booked.slipLink, courierBookedAt: now },
    })
    await logOrder({
      ...orderRef(sales),
      action: 'leopards_booked',
      message: `Booked with Leopards: ${booked.trackNumber} · COD ${rs(cod)} · ${weight} g × ${pieces} · to ${city.name}`,
      actor: await requestActor(request),
      details: { cn: booked.trackNumber, cod, weight, pieces, cityId: city.id, city: city.name, instructions: text(body.instructions) || null },
    })
    return NextResponse.json({ trackingNumber: booked.trackNumber, hasSlip: Boolean(booked.slipLink) }, { status: 201 })
  } catch (error: any) {
    console.error('Leopards booking failed:', error)
    return NextResponse.json({ error: error.message || 'Leopards booking failed' }, { status: 502 })
  }
}

// Cancel the Leopards booking (only works before Leopards picks it up). Clears the tracking number.
export async function DELETE(request: NextRequest, { params }: { params: { id: string } }) {
  try {
    const sales = await loadParcel(params.id)
    if (!sales.length) return NextResponse.json({ error: 'Order not found' }, { status: 404 })
    const cn = sales[0].trackingNumber
    if (!cn) return NextResponse.json({ error: 'This order has no Leopards booking.' }, { status: 400 })

    await cancelPacket(cn)
    await prisma.sale.updateMany({
      where: { id: { in: sales.map((s) => s.id) } },
      data: {
        trackingNumber: null,
        courierSlipUrl: null,
        courierBookedAt: null,
        courierStatus: null,
        courierStatusCode: null,
        courierReason: null,
        courierStatusAt: null,
      },
    })
    await logOrder({
      ...orderRef(sales),
      action: 'leopards_cancelled',
      message: `Leopards booking cancelled: ${cn}`,
      actor: await requestActor(request),
      details: { cn },
    })
    return NextResponse.json({ cancelled: cn })
  } catch (error: any) {
    console.error('Leopards cancel failed:', error)
    return NextResponse.json({ error: error.message || 'Could not cancel the booking' }, { status: 502 })
  }
}
