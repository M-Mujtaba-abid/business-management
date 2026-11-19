import { NextRequest, NextResponse } from 'next/server'
import prisma from '@/lib/prisma'
import { SESSION_COOKIE, authConfigured, createSessionToken, sessionCookieOptions } from '@/lib/auth'
import { DUMMY_HASH, verifyPassword } from '@/lib/password'

export const dynamic = 'force-dynamic'

// POST { email, password } → sets the login cookie
export async function POST(request: NextRequest) {
  if (!authConfigured()) {
    return NextResponse.json({ error: 'Login is not set up on the server (AUTH_SECRET missing).' }, { status: 503 })
  }
  const body = await request.json().catch(() => ({}))
  const email = typeof body.email === 'string' ? body.email.trim().toLowerCase() : ''
  const password = typeof body.password === 'string' ? body.password : ''

  const user = email ? await prisma.user.findUnique({ where: { email } }) : null
  // Always check a hash, so a wrong email and a wrong password look the same
  const ok = await verifyPassword(password, user?.passwordHash ?? DUMMY_HASH)

  if (!user || !ok) {
    await new Promise((r) => setTimeout(r, 1000)) // slow down guessing
    return NextResponse.json({ error: 'Wrong email or password' }, { status: 401 })
  }

  await prisma.user.update({ where: { id: user.id }, data: { lastLoginAt: new Date() } })

  const res = NextResponse.json({ ok: true, name: user.name })
  res.cookies.set(SESSION_COOKIE, await createSessionToken(user.id, user.sessionVersion), sessionCookieOptions)
  return res
}

// DELETE → logs out
export async function DELETE() {
  const res = NextResponse.json({ ok: true })
  res.cookies.set(SESSION_COOKIE, '', { path: '/', maxAge: 0 })
  return res
}
