import { PrismaClient } from '@prisma/client'

const globalForPrisma = global as unknown as { prisma: PrismaClient }

export const prisma =
  globalForPrisma.prisma ||
  new PrismaClient({
    log: ['query', 'error', 'warn'],
    // Neon can take a few seconds to wake up; the 2s default made transactions fail with
    // "Unable to start a transaction in the given time"
    transactionOptions: { maxWait: 10000, timeout: 20000 },
  })

if (process.env.NODE_ENV !== 'production') globalForPrisma.prisma = prisma

export default prisma
