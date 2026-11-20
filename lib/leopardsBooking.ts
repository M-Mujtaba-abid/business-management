// Book Leopards parcels from the app (eCom Merchant API v2: bookPacket, cancelBookedPackets, getAllCities).
// Server only. Our own details (shipper name, phone, address, origin city, return address) are sent as
// 'self' / left empty, so Leopards uses what is on our account (232883 / FANCY STORE).
import { leopardsEnabled, normalizeCN } from '@/lib/leopards'

const BASE = 'https://merchantapi.leopardscourier.com/api'
const API_KEY = process.env.LEOPARDS_API_KEY || ''
const API_PASSWORD = process.env.LEOPARDS_API_PASSWORD || ''

export interface LeopardsCity {
  id: number
  name: string
}

// ── City list (cached for a day) ──
let cityCache: { at: number; list: LeopardsCity[] } | null = null

export async function leopardsCities(): Promise<LeopardsCity[]> {
  if (cityCache && Date.now() - cityCache.at < 24 * 60 * 60 * 1000) return cityCache.list
  if (!leopardsEnabled()) return []
  const qs = new URLSearchParams({ api_key: API_KEY, api_password: API_PASSWORD })
  const res = await fetch(`${BASE}/getAllCities/format/json/?${qs}`, { cache: 'no-store', signal: AbortSignal.timeout(20000) })
  const json: any = await res.json()
  const list: LeopardsCity[] = (Array.isArray(json?.city_list) ? json.city_list : [])
    .filter((c: any) => c && c.allow_as_destination !== false && c.id && c.name)
    .map((c: any) => ({ id: Number(c.id), name: String(c.name).trim() }))
    .sort((a: LeopardsCity, b: LeopardsCity) => a.name.localeCompare(b.name))
  if (list.length) cityCache = { at: Date.now(), list }
  return list
}

const norm = (s: string) =>
  s
    .toLowerCase()
    .replace(/[^a-z]/g, '')
    .replace(/aa/g, 'a')
    .replace(/ee/g, 'i')

// Our city name → Leopards city (exact, then ignoring spelling like Gujraat / Gujrat)
export function matchCity(cities: LeopardsCity[], name: string | null | undefined): LeopardsCity | null {
  if (!name) return null
  const n = name.trim().toLowerCase()
  const exact = cities.find((c) => c.name.toLowerCase() === n)
  if (exact) return exact
  const k = norm(name)
  return cities.find((c) => norm(c.name) === k) || null
}

// ── Book ──
export interface BookInput {
  orderRef: string // our order number, printed on the label (e.g. "1205")
  destinationCityId: number
  consigneeName: string
  consigneePhone: string
  consigneePhone2?: string | null
  consigneeAddress: string
  codAmount: number // cash to collect (0 = already paid)
  weightGrams: number
  pieces: number
  instructions?: string | null
}

export async function bookPacket(input: BookInput): Promise<{ trackNumber: string; slipLink: string | null }> {
  if (!leopardsEnabled()) throw new Error('Leopards API key / password are not set on the server.')
  const body = {
    api_key: API_KEY,
    api_password: API_PASSWORD,
    booked_packet_weight: Math.max(1, Math.round(input.weightGrams)),
    booked_packet_no_piece: Math.max(1, Math.round(input.pieces)),
    booked_packet_collect_amount: Math.max(0, Math.round(input.codAmount)),
    booked_packet_order_id: input.orderRef,
    origin_city: 'self',
    destination_city: input.destinationCityId,
    shipment_id: '',
    shipment_name_eng: 'self',
    shipment_email: 'self',
    shipment_phone: 'self',
    shipment_address: 'self',
    consignment_name_eng: input.consigneeName,
    consignment_email: '',
    consignment_phone: input.consigneePhone,
    consignment_phone_two: input.consigneePhone2 || '',
    consignment_phone_three: '',
    consignment_address: input.consigneeAddress,
    special_instructions: input.instructions || '',
    shipment_type: '', // Leopards default: overnight
    return_address: '', // empty = our shipper address
    return_city: '', // empty = our origin city
  }
  const res = await fetch(`${BASE}/bookPacket/format/json/`, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify(body),
    cache: 'no-store',
    signal: AbortSignal.timeout(30000),
  })
  const json: any = await res.json().catch(() => null)
  if (!json || String(json.status) !== '1' || !json.track_number) {
    const err = json?.error
    const text = typeof err === 'string' ? err : err ? JSON.stringify(err) : `Leopards did not book it (HTTP ${res.status})`
    throw new Error(`Leopards: ${text}`)
  }
  return { trackNumber: normalizeCN(json.track_number), slipLink: typeof json.slip_link === 'string' ? json.slip_link : null }
}

// ── Cancel (only before Leopards picks it up) ──
export async function cancelPacket(cn: string): Promise<void> {
  if (!leopardsEnabled()) throw new Error('Leopards API key / password are not set on the server.')
  const res = await fetch(`${BASE}/cancelBookedPackets/format/json/`, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({ api_key: API_KEY, api_password: API_PASSWORD, cn_numbers: normalizeCN(cn) }),
    cache: 'no-store',
    signal: AbortSignal.timeout(30000),
  })
  const json: any = await res.json().catch(() => null)
  if (!json || String(json.status) !== '1') {
    const err = json?.error
    const text = typeof err === 'string' ? err : err ? Object.values(err).join(', ') : `HTTP ${res.status}`
    throw new Error(`Leopards could not cancel it: ${text}`)
  }
}
