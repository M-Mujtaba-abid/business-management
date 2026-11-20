import { NextResponse } from 'next/server'
import { computeAttention } from '@/lib/attention'

export const dynamic = 'force-dynamic'

// Dashboard "Needs attention" box
export async function GET() {
  try {
    return NextResponse.json({ generatedAt: new Date(), items: await computeAttention() })
  } catch (error: any) {
    console.error('Attention error:', error)
    return NextResponse.json({ error: error.message || 'Could not check what needs attention' }, { status: 500 })
  }
}
