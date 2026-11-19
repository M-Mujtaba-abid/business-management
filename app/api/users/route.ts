import { NextRequest, NextResponse } from 'next/server'
import prisma from '@/lib/prisma'
import { hashPassword } from '@/lib/password'
import { MIN_PASSWORD, cleanEmail, currentUserId, validEmail } from '@/lib/currentUser'

export const dynamic = 'force-dynamic'

const PUBLIC_FIELDS = { id: true, email: true, name: true, lastLoginAt: true, createdAt: true } as const

// List logins (never the password hash)
export async function GET(request: NextRequest) {
  const me = await currentUserId(request)
  const users = await prisma.user.findMany({ orderBy: { createdAt: 'asc' }, select: PUBLIC_FIELDS })
  return NextResponse.json(users.map((u) => ({ ...u, isMe: u.id === me })))
}

// Add a login: { name, email, password }
export async function POST(request: NextRequest) {
  try {
    const body = await request.json().catch(() => ({}))
    const name = typeof body.name === 'string' ? body.name.trim() : ''
    const email = cleanEmail(body.email)
    const password = typeof body.password === 'string' ? body.password : ''

    if (!name) return NextResponse.json({ error: 'Enter a name' }, { status: 400 })
    if (!validEmail(email)) return NextResponse.json({ error: 'Enter a valid email' }, { status: 400 })
    if (password.length < MIN_PASSWORD) {
      return NextResponse.json({ error: `Password must be at least ${MIN_PASSWORD} characters` }, { status: 400 })
    }
    if (await prisma.user.findUnique({ where: { email } })) {
      return NextResponse.json({ error: 'A user with this email already exists' }, { status: 409 })
    }

    const user = await prisma.user.create({
      data: { name, email, passwordHash: await hashPassword(password) },
      select: PUBLIC_FIELDS,
    })
    return NextResponse.json(user, { status: 201 })
  } catch (error: any) {
    return NextResponse.json({ error: error.message || 'Failed to add user' }, { status: 500 })
  }
}
