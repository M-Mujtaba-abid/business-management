import { NextRequest, NextResponse } from 'next/server'
import prisma from '@/lib/prisma'
import { withBalanceGuard, balanceErrorResponse } from '@/lib/balanceGuard'
import { deliveredProfit, payoutAmount, saleTotal, splitByWeight } from '@/lib/saleMoney'
import { cleanRef, findDuplicateRef, parseOrderDate, missingRequiredRef, cleanPhone } from '@/lib/orderRefs'
import { parseImages } from '@/lib/orderImages'
import { destroyPhoto } from '@/lib/cloudinary'
import type { Sale } from '@prisma/client'
import { logOrder, nameMaps, orderRef, requestActor, rs } from '@/lib/orderLog'
import { InventoryError, holdStock, inventoryErrorResponse, itemCost, releaseStock } from '@/lib/inventory'
import { resolveSupplierPayer } from '@/lib/supplierPayer'

// Sentinel: the form did not send a photo list, so photos stay as they are
const NO_PHOTO_CHANGE: { images: never[] } = { images: [] }

// Makes the order's saved photos match the list from the form: removed ones are deleted
// (database + Cloudinary), new ones are added. Missing list = photos untouched.
async function syncPhotos(orderNo: number | null, images: ReturnType<typeof parseImages>): Promise<{ added: number; removed: number }> {
  if (orderNo == null || 'error' in images || images === NO_PHOTO_CHANGE) return { added: 0, removed: 0 }
  const saved = await prisma.orderImage.findMany({ where: { orderNo } })
  const keep = new Set(images.images.map((i) => i.id).filter(Boolean) as string[])
  const removed = saved.filter((p) => !keep.has(p.id))
  const added = images.images.filter((i) => !i.id || !saved.some((p) => p.id === i.id))
  if (!removed.length && !added.length) return { added: 0, removed: 0 }
  await prisma.$transaction([
    prisma.orderImage.deleteMany({ where: { id: { in: removed.map((p) => p.id) } } }),
    prisma.orderImage.createMany({
      data: added.map((i) => ({ orderNo, url: i.url, publicId: i.publicId, width: i.width ?? null, height: i.height ?? null })),
    }),
  ])
  await Promise.all(removed.map((p) => destroyPhoto(p.publicId)))
  return { added: added.length, removed: removed.length }
}

// Order history for an edit: every field that really changed, in words ("Phone: 0300… → 0301…")
async function logEdit(request: NextRequest, before: Sale[], after: Sale[], photos: { added: number; removed: number }) {
  const names = await nameMaps()
  const a = before[0]
  const b = after[0]
  const changes: string[] = []
  const diff: Record<string, { from: unknown; to: unknown }> = {}
  const note = (label: string, from: unknown, to: unknown, show = (v: unknown) => String(v ?? '—')) => {
    if ((from ?? null) === (to ?? null)) return
    changes.push(`${label}: ${show(from)} → ${show(to)}`)
    diff[label] = { from: from ?? null, to: to ?? null }
  }
  const nm = (map: Map<string, string>) => (id: unknown) => (id ? map.get(String(id)) || '?' : '—')
  const sum = (rows: Sale[], f: (s: Sale) => number) => Math.round(rows.reduce((x, s) => x + f(s), 0) * 100) / 100

  note('Customer', a.customerName, b.customerName)
  note('Phone', a.customerPhone, b.customerPhone)
  note('City', a.city, b.city)
  note('Address', a.address, b.address)
  note('Order from', a.orderSourceId, b.orderSourceId, nm(names.sources))
  note('Payment from', a.paymentSourceId, b.paymentSourceId, nm(names.payments))
  note('Money goes to', a.receivedById, b.receivedById, nm(names.people))
  note('Order ID', a.externalOrderId, b.externalOrderId)
  note('Tracking', a.trackingNumber, b.trackingNumber)
  note('Order date', a.createdAt.toISOString().slice(0, 10), b.createdAt.toISOString().slice(0, 10))
  note('Delivery charge', sum(before, (s) => s.deliveryCharge), sum(after, (s) => s.deliveryCharge), (v) => rs(Number(v)))
  note('DC paid by', a.dcPaidById, b.dcPaidById, nm(names.people))
  note('Petrol', sum(before, (s) => s.petrolCost), sum(after, (s) => s.petrolCost), (v) => rs(Number(v)))
  note('GST', sum(before, (s) => s.gstAmount), sum(after, (s) => s.gstAmount), (v) => rs(Number(v)))

  // Products: added, removed, and changes on the ones kept
  const afterIds = new Set(after.map((s) => s.id))
  const beforeById = new Map(before.map((s) => [s.id, s]))
  for (const s of before.filter((x) => !afterIds.has(x.id))) changes.push(`Removed product: ${s.productName} ×${s.quantity}`)
  for (const s of after) {
    const p = beforeById.get(s.id)
    if (!p) {
      changes.push(`Added product: ${s.productName} ×${s.quantity} @ ${rs(s.soldPrice)}`)
      continue
    }
    const label = after.length > 1 ? `${s.productName}: ` : ''
    note(`${label}Product`, p.productName, s.productName)
    note(`${label}Qty`, p.quantity, s.quantity)
    note(`${label}Sale price`, p.soldPrice, s.soldPrice, (v) => rs(Number(v)))
    note(`${label}Buy price`, p.costPrice, s.costPrice, (v) => rs(Number(v)))
    note(`${label}Supplier`, p.supplierId, s.supplierId, nm(names.suppliers))
    note(`${label}Category`, p.categoryId, s.categoryId, nm(names.categories))
  }
  if (photos.added) changes.push(`${photos.added} photo${photos.added > 1 ? 's' : ''} added`)
  if (photos.removed) changes.push(`${photos.removed} photo${photos.removed > 1 ? 's' : ''} removed`)

  if (!changes.length) return
  await logOrder({
    ...orderRef(before),
    action: 'edited',
    message: `Order edited: ${changes.join(' · ')}`,
    actor: await requestActor(request),
    details: { changes: diff, totalBefore: sum(before, saleTotal), totalAfter: sum(after, saleTotal) },
  })
}


interface EditItemInput {
  id?: string // existing product row; missing = new product added to the order
  productName?: string
  quantity?: number | string
  costPrice?: number | string
  soldPrice?: number | string
  categoryId?: string | null
  supplierId?: string | null
  returnedItemId?: string | null
  inventoryItemId?: string | null // sold from our own stock
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

    // Photos: only synced when the form sends its list
    const photos = Array.isArray(body.images) ? parseImages(body.images) : NO_PHOTO_CHANGE
    if ('error' in photos) return NextResponse.json({ error: photos.error }, { status: 400 })

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
      const photoChange = await syncPhotos(lead.orderNo, photos)
      await logEdit(request, existing, updated, photoChange)
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
      inventoryItemId: string | null
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
        inventoryItemId: it.returnedItemId ? null : it.inventoryItemId || null,
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

    // Changing "Received by", DC person or amounts cannot leave anyone below zero
    const actor = await requestActor(request)
    const supplierPayer = await resolveSupplierPayer(body.supplierPaidById)
    // A cancelled order holds no stock; every other order takes it when saved
    const holdsStock = lead.status !== 'CANCELLED'
    const saved = await withBalanceGuard(async (tx) => {
      // Removed products: stock from inventory goes back
      await releaseStock(tx, removed, 'released', 'product removed from the order', actor)
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

        // From inventory: the buy price is the item's average cost (kept as it was if the same item stays)
        let costPrice = it.costPrice
        if (it.inventoryItemId) {
          if (prev?.inventoryItemId === it.inventoryItemId) costPrice = prev.costPrice
          else {
            const inv = await itemCost(tx, it.inventoryItemId)
            if (!inv.active) throw new InventoryError(`"${inv.name}" is archived in inventory.`)
            costPrice = inv.avgCost
          }
        }
        // Stock item or quantity changed: give the old stock back first, take the new below
        if (prev?.inventoryHeld && (prev.inventoryItemId !== it.inventoryItemId || prev.quantity !== it.quantity)) {
          await releaseStock(tx, [prev], 'released', 'order edited', actor)
        }

        const supplierStatus = it.returnedItemId || it.inventoryItemId ? 'NOT_APPLICABLE' : it.supplierPaid ? 'PAID' : 'PENDING'
        const supplierPaidAt =
          supplierStatus === 'PAID' ? (prev?.supplierPaymentStatus === 'PAID' ? prev.supplierPaidAt : new Date()) : null
        // already paid: keep who paid; newly paid here: the default payer (Mujtaba) unless chosen
        const supplierPaidById =
          supplierStatus === 'PAID' ? (prev?.supplierPaymentStatus === 'PAID' ? prev.supplierPaidById : supplierPayer) : null
        const payout = payoutShares ? payoutShares[i] : null
        const receivedAmount = payout !== null && Math.abs(payout - it.soldPrice * it.quantity) >= 0.005 ? payout : null

        const data = {
          ...shared,
          productName: it.productName,
          quantity: it.quantity,
          costPrice,
          soldPrice: it.soldPrice,
          categoryId: it.categoryId,
          supplierId: it.returnedItemId || it.inventoryItemId ? null : it.supplierId,
          returnedItemId: it.returnedItemId,
          inventoryItemId: it.inventoryItemId,
          supplierPaymentStatus: supplierStatus as 'PAID' | 'PENDING' | 'NOT_APPLICABLE',
          supplierPaidAt,
          supplierPaidById,
          deliveryCharge: dcShares[i],
          // old orders may have no DC person; it stays optional on edit
          dcPaidById: deliveryTotal > 0 ? body.dcPaidById || null : null,
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
                reviewStatus: lead.reviewStatus,
                reviewStatusAt: lead.reviewStatusAt,
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
        // Take the stock (does nothing if this row already holds it); refuses if not enough
        if (holdsStock && row.inventoryItemId) {
          await holdStock(tx, [row], actor)
          rows.push(await tx.sale.findUniqueOrThrow({ where: { id: row.id } }))
        } else {
          rows.push(row)
        }
      }
      return rows
    })

    const photoChange = await syncPhotos(lead.orderNo, photos)
    await logEdit(request, existing, saved, photoChange)
    return NextResponse.json({ parcelId, sales: saved, totalSale: saved.reduce((a, s) => a + saleTotal(s), 0) })
  } catch (error: any) {
    const blocked = balanceErrorResponse(error) || inventoryErrorResponse(error)
    if (blocked) return NextResponse.json(blocked, { status: 400 })
    console.error('Edit order error:', error)
    return NextResponse.json({ error: error.message || 'Failed to save changes' }, { status: 500 })
  }
}
