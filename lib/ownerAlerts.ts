// Instant WhatsApp alerts to the owners (same numbers as the daily report).
// Leopards payment alert: sent when the Leopards check sees an invoice made ("money coming") or paid.
// Setting (AppSetting): alert.leopardsPayment = 'true' | 'false' (on by default).
import prisma from '@/lib/prisma'
import { sendOwnerMessage } from '@/lib/whatsapp'
import { getReportSettings, withLink } from '@/lib/dailyReport'

export interface PaymentChange {
  orderNo: number | null
  customer: string
  payout: number // what Leopards pays us for this order
  cod: number
  charges: number
  payment: string // 'PENDING' (invoiced) | 'PAID'
  invoiceNo: string | null
  invoiceDate: string | null
  method: string | null
  receivedBy: string | null // whose account it goes to
}

const KEY = 'alert.leopardsPayment'
const rs = (n: number) => `Rs ${Math.round(n).toLocaleString('en-PK')}`

export async function paymentAlertsOn(): Promise<boolean> {
  const row = await prisma.appSetting.findUnique({ where: { key: KEY } }).catch(() => null)
  return row ? row.value !== 'false' : true
}
export async function setPaymentAlerts(on: boolean) {
  await prisma.appSetting.upsert({ where: { key: KEY }, create: { key: KEY, value: String(on) }, update: { value: String(on) } })
}

// One message: grouped by invoice, paid first
export function buildPaymentAlert(changes: PaymentChange[]): string {
  const groups = new Map<string, PaymentChange[]>()
  for (const c of changes) {
    const k = `${c.payment}|${c.invoiceNo || '-'}`
    groups.set(k, [...(groups.get(k) || []), c])
  }
  const blocks = Array.from(groups.values())
    .sort((a, b) => (a[0].payment === 'PAID' ? -1 : 1) - (b[0].payment === 'PAID' ? -1 : 1))
    .map((list) => {
      const first = list[0]
      const total = list.reduce((a, c) => a + c.payout, 0)
      const people = Array.from(new Set(list.map((c) => c.receivedBy).filter(Boolean)))
      const head =
        first.payment === 'PAID'
          ? `✅ *Leopards PAID* ${rs(total)}`
          : `🧾 *Leopards invoice made* · ${rs(total)} coming`
      return [
        head,
        `Invoice: ${first.invoiceNo || '—'}${first.invoiceDate ? ` · ${first.invoiceDate}` : ''}${first.method ? ` · ${first.method}` : ''}`,
        ...list.map((c) => `${c.orderNo != null ? `#${c.orderNo}` : '—'} ${c.customer}: *${rs(c.payout)}* (COD ${rs(c.cod)} − ${rs(c.charges)})`),
        `Total: *${rs(total)}*${people.length ? ` → ${people.join(', ')}` : ''}`,
        first.payment === 'PAID' ? 'Orders marked Received in the app.' : 'Orders stay Not received until Leopards pays.',
      ].join('\n')
    })
  // link opens the Orders page (Leopards column shows the money of each order)
  return withLink(['💰 *Leopards payment update*', '', blocks.join('\n\n')].join('\n'), 'orders')
}

// Example for the Settings preview / test: the latest Leopards orders that are invoiced or paid
export async function samplePaymentChanges(): Promise<PaymentChange[]> {
  const rows = await prisma.sale.findMany({
    where: { courierPayment: { in: ['PENDING', 'PAID'] }, courierPayout: { not: null } },
    orderBy: { courierMoneyAt: 'desc' },
    take: 20,
    select: { orderNo: true, customerName: true, courierPayout: true, courierCod: true, courierCharges: true, courierPayment: true, courierMoney: true, receivedBy: { select: { name: true } } },
  })
  const seen = new Set<number | null>()
  return rows
    .filter((r) => (seen.has(r.orderNo) ? false : (seen.add(r.orderNo), true)))
    .slice(0, 6)
    .map((r) => {
      const m = (r.courierMoney as any) || {}
      return {
        orderNo: r.orderNo,
        customer: r.customerName,
        payout: r.courierPayout || 0,
        cod: r.courierCod || 0,
        charges: r.courierCharges || 0,
        payment: r.courierPayment as string,
        invoiceNo: m.invoiceNo || null,
        invoiceDate: m.invoiceDate || null,
        method: m.paymentMethod || null,
        receivedBy: r.receivedBy?.name || null,
      }
    })
}

// Sends the alert if it is switched on and numbers are set. Never throws.
export async function sendPaymentAlert(changes: PaymentChange[]): Promise<void> {
  try {
    if (!changes.length || !(await paymentAlertsOn())) return
    const { recipients } = await getReportSettings()
    if (!recipients.length) return
    const text = buildPaymentAlert(changes)
    for (const r of recipients) {
      const err = await sendOwnerMessage(r.phone, text)
      if (err) console.warn(`Leopards payment alert to ${r.name || r.phone} not sent: ${err}`)
    }
  } catch (err) {
    console.error('Leopards payment alert failed:', err)
  }
}
