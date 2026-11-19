import { NextRequest, NextResponse } from 'next/server'
import { SESSION_COOKIE } from '@/lib/auth'
import { activeSessionUser } from '@/lib/session'

export const dynamic = 'force-dynamic'

// Who is logged in → { name, email }
export async function GET(request: NextRequest) {
  const user = await activeSessionUser(request.cookies.get(SESSION_COOKIE)?.value)
  if (!user) return NextResponse.json({ error: 'Not logged in' }, { status: 401 })
  return NextResponse.json({ name: user.name, email: user.email })
}
