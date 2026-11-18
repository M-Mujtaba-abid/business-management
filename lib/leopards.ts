// Leopards courier tracking (eCom Merchant API v2, "Track Booked Packet").
// Server only: the API key and password stay on the server. The public /track/[cn] page shows a
// trimmed result (status, cities, dates); the customer's phone, address and name are never passed on.

const TRACK_API = 'https://merchantapi.leopardscourier.com/api/trackBookedPacket/format/json/'
const API_KEY = process.env.LEOPARDS_API_KEY || ''
const API_PASSWORD = process.env.LEOPARDS_API_PASSWORD || ''

// Public address of this website, for links sent to customers (e.g. https://shop.example.com).
// On Vercel the production domain is used when APP_URL is not set.
const BASE_URL = (
  process.env.APP_URL ||
  (process.env.VERCEL_PROJECT_PRODUCTION_URL ? `https://${process.env.VERCEL_PROJECT_PRODUCTION_URL}` : '')
).replace(/\/+$/, '')

export const leopardsEnabled = () => Boolean(API_KEY && API_PASSWORD)

// A Leopards consignment number: 2 letters (origin city) + 10 digits, e.g. LE7549254868
export const normalizeCN = (v: unknown) => String(v ?? '').replace(/\s+/g, '').toUpperCase()
export const isLeopardsCN = (v: unknown) => /^[A-Z]{2}\d{10}$/.test(normalizeCN(v))

// Link to our own tracking page, or '' when it can't be built (not a Leopards number, no site address)
export function trackingLink(cn: unknown): string {
  const n = normalizeCN(cn)
  if (!BASE_URL || !isLeopardsCN(n)) return ''
  return `${BASE_URL}/track/${n}`
}

export interface TrackingEvent {
  status: string
  date: string // yyyy-mm-dd
  time: string // HH:MM, may be empty
}

export interface Tracking {
  cn: string
  status: string
  origin: string
  destination: string
  bookedOn: string // as Leopards sends it, dd/mm/yyyy
  events: TrackingEvent[] // newest first
}

export type TrackResult = { ok: true; tracking: Tracking } | { ok: false; reason: 'not-configured' | 'not-found' | 'error' }

const CACHE_MS = 10 * 60 * 1000 // a customer refreshing the page doesn't call Leopards every time
const cache = new Map<string, { at: number; result: TrackResult }>()

const text = (v: unknown) => (typeof v === 'string' ? v.replace(/\s+/g, ' ').trim() : '')

export async function trackPacket(cnInput: string): Promise<TrackResult> {
  const cn = normalizeCN(cnInput)
  if (!leopardsEnabled()) return { ok: false, reason: 'not-configured' }

  const hit = cache.get(cn)
  if (hit && Date.now() - hit.at < CACHE_MS) return hit.result

  let result: TrackResult
  try {
    const res = await fetch(TRACK_API, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ api_key: API_KEY, api_password: API_PASSWORD, track_numbers: cn }),
      cache: 'no-store',
      signal: AbortSignal.timeout(10000),
    })
    const json: any = await res.json()
    const p = Array.isArray(json?.packet_list) ? json.packet_list[0] : null
    if (json?.status !== 1 || !p) {
      result = { ok: false, reason: 'not-found' }
    } else {
      const details: any[] = Array.isArray(p['Tracking Detail']) ? p['Tracking Detail'] : []
      const events = details
        .map((d) => ({
          status: text(d.Status ?? d.Staus),
          date: text(d.Activity_Date ?? d['Activity Date']),
          time: text(d.Activity_Time).slice(0, 5),
        }))
        .filter((e) => e.status)
        .reverse()
      result = {
        ok: true,
        tracking: {
          cn,
          status: text(p.booked_packet_status) || events[0]?.status || 'Booked',
          origin: text(p.origin_city_name),
          destination: text(p.destination_city_name),
          bookedOn: text(p.booking_date),
          events,
        },
      }
    }
  } catch (err) {
    console.error('Leopards tracking failed:', err)
    return { ok: false, reason: 'error' } // not cached: try again on the next visit
  }

  cache.set(cn, { at: Date.now(), result })
  if (cache.size > 500) cache.delete(cache.keys().next().value as string)
  return result
}

// ── Push API: Leopards posts every status change to /api/leopards/push ──

// What a status means for us
//  transit   – on the way (booked, picked, dispatched, arrived at station)
//  out       – out for delivery
//  delivered – delivered to the customer (terminal)
//  attempt   – a delivery attempt failed, Leopards will try again
//  returning – on its way back to us
//  returned  – back with Leopards' warehouse / us (terminal)
export type CourierKind = 'transit' | 'out' | 'delivered' | 'attempt' | 'returning' | 'returned'

// Status short codes from the Leopards Push API document (v1.0)
export const LEOPARDS_STATUSES: Record<string, { label: string; kind: CourierKind; names: string[] }> = {
  RC: { label: 'Booked', kind: 'transit', names: ['consignment booked', 'shipment scanned in lcs facility'] },
  SP: { label: 'Picked up', kind: 'transit', names: ['shipment picked'] },
  DP: { label: 'Dispatched', kind: 'transit', names: ['dispatched'] },
  AR: { label: 'Arrived at station', kind: 'transit', names: ['arrived at station'] },
  AC: { label: 'Out for delivery', kind: 'out', names: ['assigned to courier', 'out for delivery'] },
  DV: { label: 'Delivered', kind: 'delivered', names: ['delivered'] },
  PN1: { label: '1st delivery attempt failed', kind: 'attempt', names: ['first attempt in forward leg'] },
  PN2: { label: '2nd delivery attempt failed', kind: 'attempt', names: ['second attempt in forward leg'] },
  RO: { label: 'Being returned', kind: 'returning', names: ['being return', 'being returned'] },
  NR: { label: 'Ready for return', kind: 'returning', names: ['ready for return'] },
  RN1: { label: 'Return: 1st attempt', kind: 'returning', names: ['first attempt in reverse leg'] },
  RN2: { label: 'Return: 2nd attempt', kind: 'returning', names: ['second attempt in reverse leg'] },
  RW: { label: 'Returned to warehouse', kind: 'returned', names: ['returned to warehouse'] },
  DW: { label: 'Delivered to warehouse', kind: 'returned', names: ['delivered to warehouse'] },
  RS: { label: 'Returned to shipper', kind: 'returned', names: ['returned to shipper'] },
  DR: { label: 'Delivered to vendor', kind: 'returned', names: ['delivered to vendor'] },
}

// Leopards may send the short code ("DV") or the name ("Delivered"); both are understood
export function classifyCourierStatus(raw: unknown): { code: string | null; label: string; kind: CourierKind } {
  const t = String(raw ?? '').trim()
  const upper = t.toUpperCase()
  if (LEOPARDS_STATUSES[upper]) return { code: upper, ...LEOPARDS_STATUSES[upper] }
  const name = t.toLowerCase().replace(/\(.*?\)/g, '').replace(/\s+/g, ' ').trim()
  for (const [code, s] of Object.entries(LEOPARDS_STATUSES)) {
    if (s.names.includes(name)) return { code, label: s.label, kind: s.kind }
  }
  // Unknown wording: a best guess from the words used
  const kind: CourierKind = /return|reverse/.test(name)
    ? 'returning'
    : /out for delivery|assigned/.test(name)
    ? 'out'
    : /attempt|pending/.test(name)
    ? 'attempt'
    : 'transit'
  return { code: null, label: t || 'Unknown', kind }
}

// "2026-11-18 09:07:00" (Pakistan time) → Date
export function parseLeopardsDate(v: unknown): Date | null {
  const m = String(v ?? '').trim().match(/^(\d{4})-(\d{2})-(\d{2})(?:[ T](\d{1,2}):(\d{2})(?::(\d{2}))?)?/)
  if (!m) return null
  const d = new Date(`${m[1]}-${m[2]}-${m[3]}T${(m[4] || '00').padStart(2, '0')}:${m[5] || '00'}:${m[6] || '00'}+05:00`)
  return isNaN(d.getTime()) ? null : d
}
