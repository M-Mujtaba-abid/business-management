import { NextRequest, NextResponse } from 'next/server'
import prisma from '@/lib/prisma'
import { hashPassword } from '@/lib/password'
import { MIN_PASSWORD, cleanEmail, currentUserId, validEmail } from '@/lib/currentUser'
import { SESSION_COOKIE, createSessionToken, sessionCookieOptions } from '@/lib/auth'

export const dynamic = 'force-dynamic'

// Change a login's name / email / password: { name?, email?, password? }
export async function PATCH(request: NextRequest, { params }: { params: { id: string } }) {
  try {
    const me = await currentUserId(request)
    const body = await request.json().catch(() => ({}))
    const data: { name?: string; email?: string; passwordHash?: string; sessionVersion?: { increment: number } } = {}

    if (body.name !== undefined) {
      const name = typeof body.name === 'string' ? body.name.trim() : ''
      if (!name) return NextResponse.json({ error: 'Enter a name' }, { status: 400 })
      data.name = name
    }
    if (body.email !== undefined) {
      const email = cleanEmail(body.email)
      if (!validEmail(email)) return NextResponse.json({ error: 'Enter a valid email' }, { status: 400 })
      const other = await prisma.user.findUnique({ where: { email } })
      if (other && other.id !== params.id) {
        return NextResponse.json({ error: 'Another user already has this email' }, { status: 409 })
      }
      data.email = email
    }
    if (body.password !== undefined) {
      const password = typeof body.password === 'string' ? body.password : ''
      if (password.length < MIN_PASSWORD) {
        return NextResponse.json({ error: `Password must be at least ${MIN_PASSWORD} characters` }, { status: 400 })
      }
      data.passwordHash = await hashPassword(password)
      // New password: every device logged in with the old one is logged out
      data.sessionVersion = { increment: 1 }
    }

    const user = await prisma.user.update({
      where: { id: params.id },
      data,
      select: { id: true, email: true, name: true, sessionVersion: true },
    })
    const res = NextResponse.json({ id: user.id, email: user.email, name: user.name })

    // Changing your own password keeps you logged in on this device only
    if (data.sessionVersion && me === user.id) {
      res.cookies.set(SESSION_COOKIE, await createSessionToken(user.id, user.sessionVersion), sessionCookieOptions)
    }
    return res
  } catch (error: any) {
    return NextResponse.json({ error: error.message || 'Failed to update user' }, { status: 500 })
  }
}

// Remove a login (not your own, and never the last one, so nobody gets locked out)
export async function DELETE(request: NextRequest, { params }: { params: { id: string } }) {
  try {
    if ((await currentUserId(request)) === params.id) {
      return NextResponse.json({ error: 'You cannot remove your own login' }, { status: 400 })
    }
    if ((await prisma.user.count()) <= 1) {
      return NextResponse.json({ error: 'At least one user must remain' }, { status: 400 })
    }
    await prisma.user.delete({ where: { id: params.id } })
    return NextResponse.json({ success: true })
  } catch (error: any) {
    return NextResponse.json({ error: error.message || 'Failed to remove user' }, { status: 500 })
  }
}
