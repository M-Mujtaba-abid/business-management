import crypto from 'crypto'
import { NextRequest, NextResponse } from 'next/server'
import { isLeopardsCN, normalizeCN, parseLeopardsDate } from '@/lib/leopards'
import { applyCourierStatus } from '@/lib/courierUpdate'

// Leopards Push API (v1.0): Leopards POSTs every status change of our parcels here.
//   { "data": [ { "cn_number", "status", "receiver_name", "reason", "activity_date" } ] }
// Reply: 202 [{ status: 1, errors: [] }], 401 when the secret is wrong, 400 for a bad body.
//
// What we do with a status: see lib/courierUpdate.ts (shared with the daily "Check Leopards" sync)

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
      const result = await applyCourierStatus({
        cn,
        status: item?.status,
        at: parseLeopardsDate(item?.activity_date) || new Date(),
        receiver: item?.receiver_name,
        reason: item?.reason,
      })
      if (result !== 'no-order') matched++ // 'no-order': not one of our orders (or not saved yet)
    } catch (err: any) {
      console.error('Leopards push item failed:', cn, err)
      errors.push(`${cn}: ${err?.message || 'failed'}`)
    }
  }

  console.log(`Leopards push: ${items.length} status(es), ${matched} matched our orders, ${errors.length} error(s)`)
  // 202 even when some items failed, so Leopards doesn't keep re-sending the good ones; errors are listed
  return reply(202, errors)
}
