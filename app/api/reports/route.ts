import { NextRequest, NextResponse } from 'next/server'
import { buildReport, getReportSettings, ReportSlot, saveReportSettings, sendDailyReport } from '@/lib/dailyReport'
import { buildPaymentAlert, paymentAlertsOn, samplePaymentChanges, setPaymentAlerts } from '@/lib/ownerAlerts'
import { sendOwnerMessage } from '@/lib/whatsapp'

export const dynamic = 'force-dynamic'
export const maxDuration = 60

const slotOf = (v: unknown): ReportSlot => (v === 'morning' ? 'morning' : 'night')

// Example text of the Leopards payment alert (from the latest invoiced / paid Leopards orders)
async function leopardsPreview() {
  const sample = await samplePaymentChanges()
  return sample.length ? buildPaymentAlert(sample) : 'No invoiced or paid Leopards orders yet to show as an example.'
}

// GET ?preview=morning|night|leopards → settings (+ the message text when preview is asked)
export async function GET(request: NextRequest) {
  try {
    const preview = request.nextUrl.searchParams.get('preview')
    const settings = await getReportSettings()
    const text = preview === 'leopards' ? await leopardsPreview() : preview ? await buildReport(slotOf(preview)) : undefined
    return NextResponse.json({ ...settings, leopardsPayment: await paymentAlertsOn(), ...(text !== undefined ? { preview: text } : {}) })
  } catch (error: any) {
    return NextResponse.json({ error: error.message || 'Could not load the report settings' }, { status: 500 })
  }
}

// PUT { recipients?, morning?, night?, leopardsPayment? } → save settings
export async function PUT(request: NextRequest) {
  try {
    const body = await request.json().catch(() => ({}))
    await saveReportSettings({
      recipients: Array.isArray(body.recipients) ? body.recipients : undefined,
      morning: typeof body.morning === 'boolean' ? body.morning : undefined,
      night: typeof body.night === 'boolean' ? body.night : undefined,
    })
    if (typeof body.leopardsPayment === 'boolean') await setPaymentAlerts(body.leopardsPayment)
    return NextResponse.json({ ...(await getReportSettings()), leopardsPayment: await paymentAlertsOn() })
  } catch (error: any) {
    return NextResponse.json({ error: error.message || 'Could not save' }, { status: 500 })
  }
}

// POST { slot: 'morning' | 'night' | 'leopards' } → send it now to everyone in the list (test button)
export async function POST(request: NextRequest) {
  try {
    const body = await request.json().catch(() => ({}))
    if (body.slot === 'leopards') {
      const { recipients } = await getReportSettings()
      if (!recipients.length) return NextResponse.json({ error: 'No phone numbers in Settings → Daily WhatsApp report.' }, { status: 400 })
      const text = `🧪 *Test* — this is how a Leopards payment alert looks:\n\n${await leopardsPreview()}`
      const errors: string[] = []
      let sent = 0
      for (const r of recipients) {
        const err = await sendOwnerMessage(r.phone, text)
        if (err) errors.push(`${r.name || r.phone}: ${err}`)
        else sent++
      }
      if (!sent) return NextResponse.json({ error: errors.join(' · ') || 'Not sent' }, { status: 502 })
      return NextResponse.json({ sent, errors })
    }
    const result = await sendDailyReport(slotOf(body.slot), { force: true })
    if (result.skipped) return NextResponse.json({ error: result.skipped }, { status: 400 })
    if (result.sent === 0) return NextResponse.json({ error: result.errors.join(' · ') || 'Not sent' }, { status: 502 })
    return NextResponse.json(result)
  } catch (error: any) {
    return NextResponse.json({ error: error.message || 'Could not send' }, { status: 500 })
  }
}
