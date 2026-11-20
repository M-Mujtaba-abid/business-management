import crypto from 'crypto'
import type { NextRequest } from 'next/server'

// Vercel cron jobs send "Authorization: Bearer <CRON_SECRET>"
export function cronAuthorized(req: NextRequest): boolean {
  const secret = process.env.CRON_SECRET || ''
  const given = (req.headers.get('authorization') || '').replace(/^bearer\s+/i, '')
  return secret.length > 0 && given.length === secret.length && crypto.timingSafeEqual(Buffer.from(given), Buffer.from(secret))
}
