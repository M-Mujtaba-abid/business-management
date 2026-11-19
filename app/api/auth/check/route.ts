import { NextRequest, NextResponse } from 'next/server'
import { SESSION_COOKIE } from '@/lib/auth'
import { activeSessionUser } from '@/lib/session'

export const dynamic = 'force-dynamic'

// Used by middleware on every request: is this login still valid in the database?
// (User not removed, password not changed since.) Answers only yes (200) / no (401).
export async function GET(request: NextRequest) {
  try {
    const user = await activeSessionUser(request.cookies.get(SESSION_COOKIE)?.value)
    return user ? NextResponse.json({ ok: true }) : NextResponse.json({ ok: false }, { status: 401 })
  } catch {
    return NextResponse.json({ ok: false }, { status: 503 })
  }
}
