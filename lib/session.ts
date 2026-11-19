// Server (Node) side of the login check: signature + the user still exists + same sessionVersion.
import prisma from '@/lib/prisma'
import { readSession } from '@/lib/auth'

export async function activeSessionUser(token: string | undefined) {
  const s = await readSession(token)
  if (!s) return null
  const user = await prisma.user.findUnique({
    where: { id: s.userId },
    select: { id: true, name: true, email: true, sessionVersion: true },
  })
  return user && user.sessionVersion === s.version ? user : null
}
