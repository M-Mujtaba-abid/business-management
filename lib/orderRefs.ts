import type { Prisma } from '@prisma/client'

// Order identity: our own number (#1001...), the Daraz / Website order ID and the courier tracking number

// Trimmed reference, or null when blank
export const cleanRef = (v: unknown): string | null => {
  const s = typeof v === 'string' ? v.trim() : v === undefined || v === null ? '' : String(v).trim()
  return s ? s : null
}

// Next order number from an atomic counter, so two orders saved together never share a number
export async function nextOrderNo(tx: Prisma.TransactionClient): Promise<number> {
  const counter = await tx.counter.upsert({
    where: { key: 'orderNo' },
    update: { value: { increment: 1 } },
    create: { key: 'orderNo', value: 1001 },
  })
  return counter.value
}

// Message when another order already uses this order ID / tracking number (the same parcel excluded)
export async function findDuplicateRef(
  db: Prisma.TransactionClient,
  refs: { externalOrderId: string | null; trackingNumber: string | null },
  excludeIds: string[] = []
): Promise<string | null> {
  const checks: [string, 'externalOrderId' | 'trackingNumber', string | null][] = [
    ['Order ID', 'externalOrderId', refs.externalOrderId],
    ['Tracking number', 'trackingNumber', refs.trackingNumber],
  ]
  for (const [label, field, value] of checks) {
    if (!value) continue
    const other = await db.sale.findFirst({
      where: {
        [field]: { equals: value, mode: 'insensitive' },
        ...(excludeIds.length ? { id: { notIn: excludeIds } } : {}),
      },
      select: { orderNo: true, productName: true },
    })
    if (other) {
      return `${label} "${value}" is already on order ${other.orderNo ? `#${other.orderNo}` : ''} (${other.productName}).`
    }
  }
  return null
}

// Order date sent by the form (ISO with timezone). Undefined = not sent / keep; Error message when invalid.
// Earliest order date allowed when adding / back-dating an order
export const oldestOrderDate = () => {
  const d = new Date()
  d.setFullYear(d.getFullYear() - 1)
  return d
}

export const parseOrderDate = (v: unknown): Date | undefined | string => {
  if (v === undefined || v === null || v === '') return undefined
  const d = new Date(String(v))
  if (isNaN(d.getTime())) return 'Order date is not valid.'
  // allow a little clock drift, but not orders dated in the future
  if (d.getTime() > Date.now() + 5 * 60 * 1000) return 'Order date cannot be in the future.'
  // a wrong year (typo / autofill) would bury the order at the end of the list
  if (d.getTime() < oldestOrderDate().getTime()) return 'Order date is more than a year ago. Check the year.'
  return d
}

// Required references per order source: Daraz needs its order ID, Website needs the Leopards tracking number
export async function missingRequiredRef(
  db: Prisma.TransactionClient,
  orderSourceId: string | null | undefined,
  refs: { externalOrderId: string | null; trackingNumber: string | null }
): Promise<string | null> {
  if (!orderSourceId) return null
  const source = await db.orderSource.findUnique({ where: { id: orderSourceId }, select: { name: true } })
  const name = source?.name.trim().toLowerCase()
  if (name === 'daraz' && !refs.externalOrderId) return 'Daraz Order ID is required for Daraz orders.'
  if (name === 'website' && !refs.trackingNumber) return 'Leopards tracking number is required for Website orders.'
  return null
}

// Customer phone: keeps digits (and a leading +), e.g. "0300-1234567" → "03001234567".
// Returns null when it does not look like a phone number (10–13 digits).
export const cleanPhone = (v: unknown): string | null => {
  const raw = typeof v === 'string' ? v.trim() : ''
  const digits = raw.replace(/\D/g, '')
  if (digits.length < 10 || digits.length > 13) return null
  return (raw.startsWith('+') ? '+' : '') + digits
}
