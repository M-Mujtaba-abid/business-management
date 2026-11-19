import { NextRequest, NextResponse } from 'next/server'
import { SESSION_COOKIE, readSession } from '@/lib/auth'

// Everything is private except what customers and outside services must reach:
//  - /track/<cn>               tracking page link sent to customers on WhatsApp
//  - /login, /api/auth/login   the login screen itself
//  - /api/auth/check           the login check this middleware calls (answers yes / no only)
//  - /api/leopards/push        Leopards status push (checks LEOPARDS_PUSH_SECRET itself)
//  - /api/whatsapp/webhook     wa-service callbacks (checks WA_WEBHOOK_SECRET itself)
//  - /api/cron/*               Vercel cron jobs (check CRON_SECRET themselves)
const PUBLIC_PATHS = [
  '/track',
  '/login',
  '/api/auth/login',
  '/api/auth/check',
  '/api/leopards/push',
  '/api/whatsapp/webhook',
  '/api/cron',
]
const isPublic = (pathname: string) => PUBLIC_PATHS.some((p) => pathname === p || pathname.startsWith(`${p}/`))

// A login confirmed by the database is trusted for a few seconds, so a page that loads
// many things at once does not hit the database for each one. Removing a user or changing
// their password takes effect within this time.
const CONFIRMED_FOR_MS = 10_000
const confirmed = new Map<string, number>()

async function stillValid(req: NextRequest, token: string): Promise<boolean> {
  const until = confirmed.get(token)
  if (until && until > Date.now()) return true

  try {
    const res = await fetch(new URL('/api/auth/check', req.url), {
      headers: { cookie: `${SESSION_COOKIE}=${token}` },
      cache: 'no-store',
    })
    if (!res.ok) {
      confirmed.delete(token)
      return false
    }
  } catch {
    return false // cannot check → stay locked
  }

  if (confirmed.size > 500) confirmed.clear()
  confirmed.set(token, Date.now() + CONFIRMED_FOR_MS)
  return true
}

export async function middleware(req: NextRequest) {
  const { pathname, search } = req.nextUrl
  if (isPublic(pathname)) return NextResponse.next()

  const token = req.cookies.get(SESSION_COOKIE)?.value
  // Cheap signature check first, then the database check
  if (token && (await readSession(token)) && (await stillValid(req, token))) return NextResponse.next()

  if (pathname.startsWith('/api/')) {
    return NextResponse.json({ error: 'Not logged in' }, { status: 401 })
  }
  const login = new URL('/login', req.url)
  if (pathname !== '/') login.searchParams.set('next', pathname + search)
  const res = NextResponse.redirect(login)
  if (token) res.cookies.set(SESSION_COOKIE, '', { path: '/', maxAge: 0 }) // drop a dead login
  return res
}

// Skip Next's own files and public images (logo etc.); everything else goes through the check
export const config = {
  matcher: ['/((?!_next/static|_next/image|favicon.ico|.*\\.(?:png|jpg|jpeg|svg|webp|avif|ico|woff2?)$).*)'],
}
