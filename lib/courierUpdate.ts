// Apply one Leopards status to our orders with that tracking number.
// Used by the Leopards push webhook and by our own "Check Leopards" sync, so both behave the same:
//  - always: save it on the order (courierStatus...), shown as a badge on the Orders page
//  - picked up / dispatched / arrived / out for delivery, and the order is still Packing → Dispatched
//  - delivered, and the order is Packing / Dispatched → Delivered (the customer gets the Delivered message)
//  - being returned / returned → only the badge; marking Returned stays a manual step, because it
//    books a return loss and can put covers back in stock
import prisma from '@/lib/prisma'
import { classifyCourierStatus, normalizeCN } from '@/lib/leopards'
import { changeParcelStatus } from '@/lib/orderStatus'
import { LEOPARDS, logOrder, orderRef, ordersOf } from '@/lib/orderLog'

export type CourierUpdateResult = 'no-order' | 'stale' | 'saved' | 'dispatched' | 'delivered'

const clip = (v: unknown, n: number) => (typeof v === 'string' ? v.replace(/\s+/g, ' ').trim().slice(0, n) : '')

export async function applyCourierStatus(input: {
  cn: string
  status: unknown // Leopards short code ("DV") or name ("Delivered")
  at: Date // when it happened
  receiver?: unknown
  reason?: unknown
  via?: 'push' | 'check' // Leopards pushed it, or our own Leopards check found it
}): Promise<CourierUpdateResult> {
  const cn = normalizeCN(input.cn)
  const sales = await prisma.sale.findMany({
    where: { trackingNumber: { equals: cn, mode: 'insensitive' } },
    orderBy: { createdAt: 'asc' },
  })
  if (sales.length === 0) return 'no-order'

  const st = classifyCourierStatus(input.status)
  const receiver = clip(input.receiver, 80)
  const reason = clip(input.reason, 200)
  const note = st.kind === 'delivered' && receiver ? `Received by ${receiver}` : reason

  // An older status arriving late must not overwrite a newer one
  const newest = sales.reduce<Date | null>((m, s) => (s.courierStatusAt && (!m || s.courierStatusAt > m) ? s.courierStatusAt : m), null)
  if (newest && input.at < newest) return 'stale'

  await prisma.sale.updateMany({
    where: { id: { in: sales.map((s) => s.id) } },
    data: { courierStatus: st.label, courierStatusCode: st.code, courierReason: note || null, courierStatusAt: input.at },
  })

  // Order history: only a status Leopards has not told us before
  if (sales[0].courierStatus !== st.label || (sales[0].courierReason || null) !== (note || null)) {
    await logOrder(
      ordersOf(sales).map((rows) => ({
        ...orderRef(rows),
        action: 'leopards_status',
        message: `Leopards: ${st.label}${note ? ` · ${note}` : ''}`,
        actor: LEOPARDS,
        details: { code: st.code, status: String(input.status ?? ''), via: input.via || 'push', cn },
        at: input.at,
      }))
    )
  }

  // A tracking number normally belongs to one order (one parcel); handle each order separately just in case
  const byOrder = new Map<string, typeof sales>()
  for (const s of sales) {
    const key = s.parcelId || (s.orderNo != null ? `#${s.orderNo}` : s.id)
    byOrder.set(key, [...(byOrder.get(key) || []), s])
  }
  let result: CourierUpdateResult = 'saved'
  for (const parcel of Array.from(byOrder.values())) {
    const current = parcel[0].status
    if (st.kind === 'delivered' && (current === 'PACKING' || current === 'DISPATCHED')) {
      // also sends the Delivered WhatsApp
      await changeParcelStatus(parcel, { status: 'DELIVERED', actor: LEOPARDS, note: 'Leopards says delivered' })
      result = 'delivered'
    } else if ((st.kind === 'transit' || st.kind === 'out') && current === 'PACKING') {
      await changeParcelStatus(parcel, { status: 'DISPATCHED', actor: LEOPARDS, note: `Leopards: ${st.label}` })
      if (result !== 'delivered') result = 'dispatched'
    }
  }
  return result
}
