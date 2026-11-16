import { NextRequest, NextResponse } from 'next/server'

export const dynamic = 'force-dynamic'

const SERVICE_URL = (process.env.WA_SERVICE_URL || '').replace(/\/+$/, '')
const API_SECRET = process.env.WA_API_SECRET || ''

// Proxy to wa-service, so its secret never reaches the browser.
//   GET /api/whatsapp/status          → { configured, reachable, connected, loggedIn, phone, hasQR, queue }
//   GET /api/whatsapp/status?qr=1     → the pairing QR as a PNG (only while not linked)
//   POST /api/whatsapp/status { action: 'logout' }  → unlink the WhatsApp number
async function callService(path: string, init?: RequestInit) {
  return fetch(`${SERVICE_URL}${path}`, {
    ...init,
    headers: { Authorization: `Bearer ${API_SECRET}`, ...(init?.headers || {}) },
    signal: AbortSignal.timeout(8000),
    cache: 'no-store',
  })
}

export async function GET(request: NextRequest) {
  if (!SERVICE_URL || !API_SECRET) {
    return NextResponse.json({ configured: false, reachable: false, connected: false, loggedIn: false })
  }
  const wantQR = new URL(request.url).searchParams.get('qr') === '1'
  try {
    if (wantQR) {
      const res = await callService('/qr')
      if (!res.ok) return NextResponse.json({ error: 'No QR code right now' }, { status: res.status })
      return new NextResponse(await res.arrayBuffer(), {
        headers: { 'Content-Type': 'image/png', 'Cache-Control': 'no-store' },
      })
    }
    const res = await callService('/status')
    const data = await res.json().catch(() => ({}))
    return NextResponse.json({ configured: true, reachable: res.ok, ...data })
  } catch (err: any) {
    return NextResponse.json({ configured: true, reachable: false, connected: false, loggedIn: false, error: err?.message })
  }
}

export async function POST(request: NextRequest) {
  if (!SERVICE_URL || !API_SECRET) return NextResponse.json({ error: 'WhatsApp service is not set up.' }, { status: 400 })
  const { action } = await request.json().catch(() => ({}))
  if (action !== 'logout') return NextResponse.json({ error: 'Unknown action' }, { status: 400 })
  try {
    const res = await callService('/logout', { method: 'POST' })
    const data = await res.json().catch(() => ({}))
    return NextResponse.json(data, { status: res.status })
  } catch (err: any) {
    return NextResponse.json({ error: `WhatsApp service unreachable: ${err?.message}` }, { status: 502 })
  }
}
