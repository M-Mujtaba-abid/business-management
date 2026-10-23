import { NextRequest, NextResponse } from 'next/server'
import prisma from '@/lib/prisma'
import { deliveredProfit, payoutAmount, saleTotal, splitByWeight } from '@/lib/saleMoney'
import { cleanRef, findDuplicateRef, parseOrderDate, missingRequiredRef, cleanPhone } from '@/lib/orderRefs'

interface EditItemInput {
  id?: string // existing product row; missing = new product added to the order
  productName?: string
  quantity?: number | string
  costPrice?: number | string
  soldPrice?: number | string
  categoryId?: string | null
  supplierId?: string | null
  returnedItemId?: string | null
  supplierPaymentStatus?: 'PAID' | 'PENDING'
}

const num = (v: unknown) => (v === undefined || v === null || v === '' ? NaN : parseFloat(String(v)))
const text = (v: unknown) => (typeof v === 'string' ? v.trim() : '')

// Edits a saved order (or a whole parcel): products can be changed, added or removed.
// Status, payment status and dates stay as they are; shared costs are re-split and a delivered
// order's profit is recalculated. A returned order only allows name / category / customer edits.
export async function PUT(
  request: NextRequest,
  { params }: { params: { id: string } }
) {
  try {
    const body = await request.json()
    const lead = await prisma.sale.findUnique({ where: { id: params.id } })
    if (!lead) {
      return NextResponse.json({ error: 'Order not found' }, { status: 404 })
    }
    const existing = lead.parcelId
      ? await prisma.sale.findMany({ where: { parcelId: lead.parcelId }, orderBy: { createdAt: 'asc' } })
      : [lead]
    const existingById = new Map(existing.map((s) => [s.id, s]))

    const rawItems: EditItemInput[] = Array.isArray(body.items) ? body.items : []
    if (rawItems.length === 0) {
      return NextResponse.json({ error: 'An order needs at least one product.' }, { status: 400 })
    }
    for (const it of rawItems) {
      if (it.id && !existingById.has(it.id)) {
        return NextResponse.json({ error: 'A product does not belong to this order.' }, { status: 400 })
      }
    }

    // Shared, non-money fields (customer details are required)
    const shared = {
      customerName: text(body.customerName),
      customerPhone: cleanPhone(body.customerPhone),
      address: text(body.address),
      city: text(body.city),
      orderSourceId: body.orderSourceId || null,
      paymentSourceId: body.paymentSourceId || null,
      receivedById: body.receivedById || null,
      // order identity: editable on any order, returned ones too (the order number itself never changes)
      externalOrderId: cleanRef(body.externalOrderId),
      trackingNumber: cleanRef(body.trackingNumber),
    }

    // Order date (applies to the whole parcel); missing = keep the saved one
    const orderDate = parseOrderDate(body.orderDate)
    if (typeof orderDate === 'string') return NextResponse.json({ error: orderDate }, { status: 400 })

    // Daraz orders need the Daraz order ID, Website orders the Leopards tracking number
    const missingRef = await missingRequiredRef(prisma, shared.orderSourceId, shared)
    if (missingRef) return NextResponse.json({ error: missingRef }, { status: 400 })
    if (orderDate) Object.assign(shared, { createdAt: orderDate })

    if (!shared.customerName || !shared.city || !shared.address) {
      return NextResponse.json({ error: 'Customer name, city and address are required.' }, { status: 400 })
    }
    if (!shared.customerPhone) {
      return NextResponse.json({ error: 'Enter a valid customer phone number (e.g. 0300 1234567).' }, { status: 400 })
    }

    if (!body.allowDuplicate) {
      const duplicate = await findDuplicateRef(prisma, shared, existing.map((s) => s.id))
      if (duplicate) return NextResponse.json({ error: duplicate, duplicate: true }, { status: 409 })
    }

    // ── Returned order: money is settled, only names / categories / customer can change ──
    if (lead.status === 'RETURNED') {
      const ids = rawItems.map((i) => i.id)
      if (ids.some((id) => !id) || ids.length !== existing.length) {
        return NextResponse.json({ error: 'Products cannot be added or removed on a returned order.' }, { status: 400 })
      }
      const updated = await prisma.$transaction(
        rawItems.map((it) =>
          prisma.sale.update({
            where: { id: it.id as string },
            data: {
              ...shared,
              productName: text(it.productName) || existingById.get(it.id as string)!.productName,
              categoryId: it.categoryId || null,
            },
          })
        )
      )
      return NextResponse.json({ sales: updated })
    }

    // ── Normal edit ──
    const items: {
      id: string | null
      productName: string
      quantity: number
      costPrice: number
      soldPrice: number
      categoryId: string | null
      supplierId: string | null
      returnedItemId: string | null
      supplierPaid: boolean
    }[] = []
    for (const [i, it] of rawItems.entries()) {
      const name = text(it.productName)
      const cost = num(it.costPrice)
      const sold = num(it.soldPrice)
      const label = rawItems.length > 1 ? `Product ${i + 1}: ` : ''
      if (!name || isNaN(cost) || isNaN(sold)) {
        return NextResponse.json({ error: `${label}product name, buy price and sale price are required.` }, { status: 400 })
      }
      items.push({
        id: it.id || null,
        productName: name,
        quantity: parseInt(String(it.quantity ?? 1), 10) || 1,
        costPrice: cost,
        soldPrice: sold,
        categoryId: it.categoryId || null,
        supplierId: it.supplierId || null,
        returnedItemId: it.returnedItemId || null,
        supplierPaid: it.supplierPaymentStatus === 'PAID',
      })
    }

    const returnedIds = items.map((i) => i.returnedItemId).filter(Boolean) as string[]
    if (new Set(returnedIds).size !== returnedIds.length) {
      return NextResponse.json({ error: 'The same returned item is used twice.' }, { status: 400 })
    }

    const weights = items.map((i) => i.soldPrice * i.quantity)
    const deliveryTotal = parseFloat(body.deliveryCharge) || 0
    const dcShares = splitByWeight(deliveryTotal, weights)
    const petrolShares = splitByWeight(parseFloat(body.petrolCost) || 0, weights)
    const gstShares = splitByWeight(parseFloat(body.gstAmount) || 0, weights)

    // Payout: once received, the actual amount stays as it was (it is edited with "Edit amount");
    // otherwise the expected amount from the form (blank = full sale).
    const received = lead.paymentStatus === 'RECEIVED'
    const payoutTotal = received ? existing.reduce((a, s) => a + payoutAmount(s), 0) : num(body.expectedAmount)
    const payoutShares = isNaN(payoutTotal) ? null : splitByWeight(payoutTotal, weights)

    const parcelId =
      items.length > 1
        ? lead.parcelId || `parcel_${Date.now().toString(36)}${Math.random().toString(36).slice(2, 8)}`
        : null

    const keptIds = new Set(items.map((i) => i.id).filter(Boolean) as string[])
    const removed = existing.filter((s) => !keptIds.has(s.id))

    if (shared.city !== 'General' && deliveryTotal > 0) {
      await prisma.cityDeliveryRate.upsert({
        where: { cityName: shared.city },
        update: { deliveryFee: deliveryTotal },
        create: { cityName: shared.city, deliveryFee: deliveryTotal },
      })
    }

    const saved = await prisma.$transaction(async (tx) => {
      // Removed products: their returned cover goes back to returned stock, then the row goes
      for (const s of removed) {
        if (s.returnedItemId) {
          await tx.returnedItem.updateMany({
            where: { id: s.returnedItemId, usedInSaleId: s.id },
            data: { status: 'AVAILABLE', usedInSaleId: null },
          })
        }
        await tx.returnedItem.deleteMany({ where: { sourceSaleId: s.id, status: 'AVAILABLE' } })
      }
      if (removed.length) await tx.sale.deleteMany({ where: { id: { in: removed.map((s) => s.id) } } })

      const rows = []
      for (const [i, it] of items.entries()) {
        const prev = it.id ? existingById.get(it.id)! : null

        // Returned-stock cover changed: release the old one, claim the new one
        if (prev?.returnedItemId && prev.returnedItemId !== it.returnedItemId) {
          await tx.returnedItem.updateMany({
            where: { id: prev.returnedItemId, usedInSaleId: prev.id },
            data: { status: 'AVAILABLE', usedInSaleId: null },
          })
        }
        const claimsNewReturned = it.returnedItemId && it.returnedItemId !== prev?.returnedItemId
        if (claimsNewReturned) {
          const r = await tx.returnedItem.findUnique({ where: { id: it.returnedItemId as string } })
          if (!r || r.status !== 'AVAILABLE') throw new Error('A returned item you picked is no longer available.')
        }

        const supplierStatus = it.returnedItemId ? 'NOT_APPLICABLE' : it.supplierPaid ? 'PAID' : 'PENDING'
        const supplierPaidAt =
          supplierStatus === 'PAID' ? (prev?.supplierPaymentStatus === 'PAID' ? prev.supplierPaidAt : new Date()) : null
        const payout = payoutShares ? payoutShares[i] : null
        const receivedAmount = payout !== null && Math.abs(payout - it.soldPrice * it.quantity) >= 0.005 ? payout : null

        const data = {
          ...shared,
          productName: it.productName,
          quantity: it.quantity,
          costPrice: it.costPrice,
          soldPrice: it.soldPrice,
          categoryId: it.categoryId,
          supplierId: it.returnedItemId ? null : it.supplierId,
          returnedItemId: it.returnedItemId,
          supplierPaymentStatus: supplierStatus as 'PAID' | 'PENDING' | 'NOT_APPLICABLE',
          supplierPaidAt,
          deliveryCharge: dcShares[i],
          petrolCost: petrolShares[i],
          gstAmount: gstShares[i],
          receivedAmount,
          parcelId,
        }
        const profit =
          lead.status === 'DELIVERED'
            ? deliveredProfit({ ...data, receivedAmount })
            : 0

        const row = prev
          ? await tx.sale.update({ where: { id: prev.id }, data: { ...data, profit } })
          : await tx.sale.create({
              data: {
                ...data,
                profit,
                // a new product joins the order in the same state as the rest
                status: lead.status,
                paymentStatus: lead.paymentStatus,
                paymentReceivedAt: lead.paymentReceivedAt,
                deductDeliveryOnReturn: lead.deductDeliveryOnReturn,
                createdAt: orderDate || lead.createdAt,
                orderNo: lead.orderNo,
              },
            })

        if (claimsNewReturned) {
          await tx.returnedItem.update({
            where: { id: it.returnedItemId as string },
            data: { status: 'USED', usedInSaleId: row.id },
          })
        }
        rows.push(row)
      }
      return rows
    })

    return NextResponse.json({ parcelId, sales: saved, totalSale: saved.reduce((a, s) => a + saleTotal(s), 0) })
  } catch (error: any) {
    console.error('Edit order error:', error)
    return NextResponse.json({ error: error.message || 'Failed to save changes' }, { status: 500 })
  }
}
