// Order history: one line per thing that happened to an order (by hand or automatically).
// Writing a log line never breaks the action itself: errors are only printed to the server log.
import type { NextRequest } from 'next/server'
import type { LogSource, Prisma } from '@prisma/client'
import prisma from '@/lib/prisma'
import { SESSION_COOKIE } from '@/lib/auth'
import { activeSessionUser } from '@/lib/session'

export interface Actor {
  source: LogSource
  name?: string | null
}

export const SYSTEM: Actor = { source: 'SYSTEM', name: 'System' }
export const LEOPARDS: Actor = { source: 'LEOPARDS', name: 'Leopards' }
export const WHATSAPP: Actor = { source: 'WHATSAPP', name: 'WhatsApp' }

// The logged-in person making this request
export async function requestActor(request: NextRequest): Promise<Actor> {
  try {
    const user = await activeSessionUser(request.cookies.get(SESSION_COOKIE)?.value)
    return { source: 'USER', name: user?.name || 'Unknown user' }
  } catch {
    return { source: 'USER', name: 'Unknown user' }
  }
}

export interface LogEntry {
  orderNo?: number | null
  saleId?: string | null // lead row, for orders without an order number
  action: string
  message: string
  actor: Actor
  details?: Record<string, unknown>
  at?: Date
}

export async function logOrder(entries: LogEntry | LogEntry[]): Promise<void> {
  const list = (Array.isArray(entries) ? entries : [entries]).filter((e) => e.orderNo != null || e.saleId)
  if (!list.length) return
  try {
    await prisma.orderLog.createMany({
      data: list.map((e) => ({
        orderNo: e.orderNo ?? null,
        saleId: e.orderNo != null ? null : e.saleId ?? null,
        action: e.action,
        message: e.message.slice(0, 1000),
        source: e.actor.source,
        actor: e.actor.name ?? null,
        details: (e.details ?? undefined) as Prisma.InputJsonValue | undefined,
        ...(e.at ? { createdAt: e.at } : {}),
      })),
    })
  } catch (err) {
    console.error('Order log failed:', err)
  }
}

// ── Helpers for building messages ──

export const rs = (n: number | null | undefined) => `Rs. ${Math.round(Number(n) || 0).toLocaleString('en-PK')}`

export const STATUS_WORDS: Record<string, string> = {
  PACKING: 'Packing',
  DISPATCHED: 'Dispatched',
  DELIVERED: 'Delivered',
  RETURNED: 'Returned',
  CANCELLED: 'Cancelled',
}

export const REVIEW_WORDS: Record<string, string> = {
  NONE: 'none',
  PENDING: 'Review pending',
  CALLED: 'Called customer',
  REVIEWED: 'Customer reviewed',
  DECLINED: 'No review',
}

export const WA_KIND_WORDS: Record<string, string> = {
  ORDER_CONFIRM: '"confirm your order" message',
  DISPATCHED: '"order dispatched" message',
  DELIVERED: '"order delivered" message',
  BILL: 'bill',
  REPLY_ACK: 'thank-you reply',
  ANSWER_LOCKED: '"answer already given" reply',
}

// One entry per order (a parcel's products share one order) for a list of product rows
export function ordersOf<T extends { id: string; orderNo: number | null; parcelId: string | null }>(rows: T[]): T[][] {
  const map = new Map<string, T[]>()
  for (const r of rows) {
    const key = r.orderNo != null ? `#${r.orderNo}` : r.parcelId || r.id
    map.set(key, [...(map.get(key) || []), r])
  }
  return Array.from(map.values())
}

// Who / which order: ready-made fields for logOrder from a group of rows
export const orderRef = (rows: { id: string; orderNo: number | null }[]) => ({ orderNo: rows[0]?.orderNo ?? null, saleId: rows[0]?.id ?? null })

// Names of people / sources, for readable "Noman → Mujtaba" messages
export async function nameMaps() {
  const [people, payments, sources, suppliers, categories] = await Promise.all([
    prisma.person.findMany({ select: { id: true, name: true } }),
    prisma.paymentSource.findMany({ select: { id: true, name: true } }),
    prisma.orderSource.findMany({ select: { id: true, name: true } }),
    prisma.supplier.findMany({ select: { id: true, name: true } }),
    prisma.category.findMany({ select: { id: true, name: true } }),
  ])
  const m = (list: { id: string; name: string }[]) => new Map(list.map((x) => [x.id, x.name]))
  return { people: m(people), payments: m(payments), sources: m(sources), suppliers: m(suppliers), categories: m(categories) }
}
