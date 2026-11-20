import { NextRequest, NextResponse } from 'next/server'
import { buildReport, getReportSettings, ReportSlot, saveReportSettings, sendDailyReport } from '@/lib/dailyReport'

export const dynamic = 'force-dynamic'
export const maxDuration = 60

const slotOf = (v: unknown): ReportSlot => (v === 'morning' ? 'morning' : 'night')

// GET ?preview=morning|night → settings (+ the message text when preview is asked)
export async function GET(request: NextRequest) {
  try {
    const preview = request.nextUrl.searchParams.get('preview')
    const settings = await getReportSettings()
    return NextResponse.json({ ...settings, ...(preview ? { preview: await buildReport(slotOf(preview)) } : {}) })
  } catch (error: any) {
    return NextResponse.json({ error: error.message || 'Could not load the report settings' }, { status: 500 })
  }
}

// PUT { recipients?: [{ name, phone }], morning?: boolean, night?: boolean } → save settings
export async function PUT(request: NextRequest) {
  try {
    const body = await request.json().catch(() => ({}))
    await saveReportSettings({
      recipients: Array.isArray(body.recipients) ? body.recipients : undefined,
      morning: typeof body.morning === 'boolean' ? body.morning : undefined,
      night: typeof body.night === 'boolean' ? body.night : undefined,
    })
    return NextResponse.json(await getReportSettings())
  } catch (error: any) {
    return NextResponse.json({ error: error.message || 'Could not save' }, { status: 500 })
  }
}

// POST { slot } → send it now to everyone in the list (the "Send test now" button)
export async function POST(request: NextRequest) {
  try {
    const body = await request.json().catch(() => ({}))
    const result = await sendDailyReport(slotOf(body.slot), { force: true })
    if (result.skipped) return NextResponse.json({ error: result.skipped }, { status: 400 })
    if (result.sent === 0) return NextResponse.json({ error: result.errors.join(' · ') || 'Not sent' }, { status: 502 })
    return NextResponse.json(result)
  } catch (error: any) {
    return NextResponse.json({ error: error.message || 'Could not send the report' }, { status: 500 })
  }
}
