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
