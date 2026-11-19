import { NextRequest } from 'next/server'
import { SESSION_COOKIE } from '@/lib/auth'
import { activeSessionUser } from '@/lib/session'

// Id of the user making this request (middleware already blocked requests without a valid login)
export const currentUserId = async (request: NextRequest) =>
  (await activeSessionUser(request.cookies.get(SESSION_COOKIE)?.value))?.id ?? null

export const MIN_PASSWORD = 8
export const cleanEmail = (v: unknown) => (typeof v === 'string' ? v.trim().toLowerCase() : '')
export const validEmail = (email: string) => /^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(email)
