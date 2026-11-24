// Who pays the suppliers. Every "Supplier: Paid" records a payer (Sale.supplierPaidById); the cover
// cost then leaves that person's In hand. Default: the setting supplier.defaultPayer, else the person
// named Mujtaba, else the first person. It can be changed per payment.
import type { Prisma } from '@prisma/client'
import prisma from '@/lib/prisma'

type Db = Prisma.TransactionClient | typeof prisma
const KEY = 'supplier.defaultPayer'

export async function defaultSupplierPayer(db: Db = prisma): Promise<string | null> {
  const [setting, people] = await Promise.all([
    db.appSetting.findUnique({ where: { key: KEY } }).catch(() => null),
    db.person.findMany({ orderBy: { name: 'asc' }, select: { id: true, name: true } }),
  ])
  if (setting && people.some((p) => p.id === setting.value)) return setting.value
  return (people.find((p) => p.name.toLowerCase() === 'mujtaba') || people[0])?.id ?? null
}

export async function setDefaultSupplierPayer(personId: string) {
  await prisma.appSetting.upsert({ where: { key: KEY }, create: { key: KEY, value: personId }, update: { value: personId } })
}

// A payer given by the user (if it is a real person), else the default
export async function resolveSupplierPayer(given: unknown, db: Db = prisma): Promise<string | null> {
  if (typeof given === 'string' && given) {
    const p = await db.person.findUnique({ where: { id: given }, select: { id: true } })
    if (p) return p.id
  }
  return defaultSupplierPayer(db)
}
