import crypto from 'crypto'
import { NextRequest, NextResponse } from 'next/server'
import prisma from '@/lib/prisma'
import { classifyCourierStatus, isLeopardsCN, normalizeCN, parseLeopardsDate } from '@/lib/leopards'
import { changeParcelStatus } from '@/lib/orderStatus'

// Leopards Push API (v1.0): Leopards POSTs every status change of our parcels here.
//   { "data": [ { "cn_number", "status", "receiver_name", "reason", "activity_date" } ] }
// Reply: 202 [{ status: 1, errors: [] }], 401 when the secret is wrong, 400 for a bad body.
//
// What we do with a status (for orders whose tracking number matches):
//  - always: save it on the order (courierStatus...), shown as a badge on the Orders page
//  - picked up / dispatched / arrived / out for delivery, and the order is still Packing → Dispatched
//  - delivered, and the order is Packing / Dispatched → Delivered (the customer gets the Delivered message)
//  - being returned / returned → only the badge; marking Returned stays a manual step, because it
//    books a return loss and can put covers back in stock

export const dynamic = 'force-dynamic'

const SECRET = process.env.LEOPARDS_PUSH_SECRET || ''

const reply = (status: number, errors: string[] = []) =>
  NextResponse.json([{ status: status === 202 ? 1 : 0, errors }], { status })

function sameSecret(given: string) {
  const a = Buffer.from(given)
  const b = Buffer.from(SECRET)
  return a.length === b.length && crypto.timingSafeEqual(a, b)
}

// The secret can come as a header (x-api-key / api-key / Authorization: Bearer …) or as ?key= in the URL
function authorized(req: NextRequest) {
  if (!SECRET) return false
  const auth = (req.headers.get('authorization') || '').replace(/^bearer\s+/i, '').trim()
  const candidates = [
    req.headers.get('x-api-key'),
    req.headers.get('api-key'),
    req.headers.get('api_key'),
    req.headers.get('x-leopards-secret'),
    auth,
    req.nextUrl.searchParams.get('key'),
  ]
  return candidates.some((c) => !!c && sameSecret(c.trim()))
}

const clip = (v: unknown, n: number) => (typeof v === 'string' ? v.replace(/\s+/g, ' ').trim().slice(0, n) : '')

export async function POST(req: NextRequest) {
  if (!SECRET) {
    console.error('Leopards push: LEOPARDS_PUSH_SECRET is not set, rejecting')
    return reply(401, ['Not configured'])
  }
  if (!authorized(req)) return reply(401, ['Unauthorized'])

  let body: any
  try {
    body = await req.json()
  } catch {
    return reply(400, ['Body must be JSON'])
  }
  const items: any[] = Array.isArray(body?.data) ? body.data : Array.isArray(body) ? body : body?.cn_number ? [body] : []
  if (items.length === 0) return reply(400, ['No "data" array'])

  const errors: string[] = []
  let matched = 0

  for (const item of items) {
    const cn = normalizeCN(item?.cn_number)
    try {
      if (!isLeopardsCN(cn)) {
        errors.push(`Invalid cn_number: ${clip(item?.cn_number, 30)}`)
        continue
      }
      const sales = await prisma.sale.findMany({
        where: { trackingNumber: { equals: cn, mode: 'insensitive' } },
        orderBy: { createdAt: 'asc' },
      })
      if (sales.length === 0) continue // not one of our orders (or not saved yet): nothing to do
      matched++

      const st = classifyCourierStatus(item?.status)
      const at = parseLeopardsDate(item?.activity_date) || new Date()
      const receiver = clip(item?.receiver_name, 80)
      const reason = clip(item?.reason, 200)
      const note = st.kind === 'delivered' && receiver ? `Received by ${receiver}` : reason

      // An older status arriving late must not overwrite a newer one
      const newest = sales.reduce<Date | null>((m, s) => (s.courierStatusAt && (!m || s.courierStatusAt > m) ? s.courierStatusAt : m), null)
      if (newest && at < newest) continue

      await prisma.sale.updateMany({
        where: { id: { in: sales.map((s) => s.id) } },
        data: { courierStatus: st.label, courierStatusCode: st.code, courierReason: note || null, courierStatusAt: at },
      })

      // A tracking number normally belongs to one order (one parcel); handle each order separately just in case
      const byOrder = new Map<string, typeof sales>()
      for (const s of sales) {
        const key = s.parcelId || (s.orderNo != null ? `#${s.orderNo}` : s.id)
        byOrder.set(key, [...(byOrder.get(key) || []), s])
      }
      for (const parcel of Array.from(byOrder.values())) {
        const current = parcel[0].status
        if (st.kind === 'delivered' && (current === 'PACKING' || current === 'DISPATCHED')) {
          await changeParcelStatus(parcel, { status: 'DELIVERED' })
        } else if ((st.kind === 'transit' || st.kind === 'out') && current === 'PACKING') {
          await changeParcelStatus(parcel, { status: 'DISPATCHED' })
        }
      }
    } catch (err: any) {
      console.error('Leopards push item failed:', cn, err)
      errors.push(`${cn}: ${err?.message || 'failed'}`)
    }
  }

  console.log(`Leopards push: ${items.length} status(es), ${matched} matched our orders, ${errors.length} error(s)`)
  // 202 even when some items failed, so Leopards doesn't keep re-sending the good ones; errors are listed
  return reply(202, errors)
}
