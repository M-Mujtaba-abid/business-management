import { NextRequest, NextResponse } from 'next/server'
import { toWaPhone, setOptOut } from '@/lib/whatsapp'

export const dynamic = 'force-dynamic'

// Stop / allow automatic messages to one customer by hand. Body: { phone, optedOut: boolean }
// (Customers do this themselves by replying STOP or START.)
export async function POST(request: NextRequest) {
  try {
    const { phone, optedOut } = (await request.json()) as { phone?: string; optedOut?: unknown }
    const wa = toWaPhone(phone)
    if (!wa || typeof optedOut !== 'boolean') {
      return NextResponse.json({ error: 'A valid phone and optedOut (true / false) are required.' }, { status: 400 })
    }
    await setOptOut(wa, optedOut)
    return NextResponse.json({ ok: true, phone: wa, optedOut })
  } catch (error: any) {
    console.error('WhatsApp opt-out error:', error)
    return NextResponse.json({ error: error.message || 'Could not update' }, { status: 500 })
  }
}
