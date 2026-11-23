// Leopards money (server only). Two steps:
//
//  1. refresh (needs the Leopards API) — syncLeopardsMoney()
//     getInvoices        → every Leopards payment (invoice) and its exact amount = what reaches the bank
//     getShippingCharges → per parcel: COD, charges, and which invoice took the charges / paid the COD
//     getPaymentDetails  → Leopards' payment word per parcel
//
//  2. settle (database only) — settleLeopardsMoney(), also run after "Money received" in the app
//     Per parcel:  money to you = COD − tax (WHT, % of COD) − charges
//     Leopards takes a parcel's charges in one invoice (often before delivery) and pays its COD in a
//     later one. Per invoice:  amount = Σ (COD − tax) of the orders it pays − Σ charges it takes.
//     Whatever Leopards cut beyond the API's charges (fuel surcharge added at invoicing, ...) is spread
//     over the parcels whose charges that invoice took ("extra charges"), so every order's money adds
//     up to the real invoices to the rupee.
//     Orders are marked Received when their invoice is received (button, or Leopards says paid).
//
// Only orders with no delivery charge typed by hand (deliveryCharge = 0) and not typed over
// (courierMoneyAuto) are kept in step automatically; others are left as they are.
import prisma from '@/lib/prisma'
import type { OrderStatus } from '@prisma/client'
import { leopardsEnabled, normalizeCN, isLeopardsCN } from '@/lib/leopards'
import { deliveredProfit, saleTotal, splitByWeight } from '@/lib/saleMoney'
import { LEOPARDS, LogEntry, logOrder, orderRef, rs } from '@/lib/orderLog'
import { PaymentChange, sendPaymentAlert } from '@/lib/ownerAlerts'

const BASE = 'https://merchantapi.leopardscourier.com/api'
const API_KEY = process.env.LEOPARDS_API_KEY || ''
const API_PASSWORD = process.env.LEOPARDS_API_PASSWORD || ''
const BATCH = 50 // Leopards allows 50 CN numbers per call
const LOOKBACK_DAYS = 120
const INVOICE_LOOKBACK_DAYS = 180

// Tax Leopards cuts from the COD it collects: 2% income tax + 2% sales tax (withholding)
const WHT_KEY = 'leopards.whtPercent'
export const DEFAULT_WHT_PERCENT = 4

export type CourierPayment = 'NOT_INVOICED' | 'PENDING' | 'PAID' | string

// Saved in Sale.courierMoney (same for every product of a parcel) and shown in the popup.
// Never holds Leopards' slip link (it carries our API key and password).
export interface CourierMoney {
  cod: number
  shipmentCharges: number
  cashHandling: number
  insurance: number
  fuelPercent: number
  fuelAmount: number
  returnCharges: number
  otherCharges: number // OSA etc.
  gstPercent: number
  gstAmount: number
  netCharges: number // before GST
  grossCharges: number // Leopards' charges from the API
  extraCharges: number // more cut in the invoice than the API shows (fuel etc.), 0 until invoiced
  totalCharges: number // grossCharges + extraCharges
  whtPercent: number
  whtAmount: number // tax on the COD (0 for returned / prepaid parcels)
  payout: number // cod − whtAmount − totalCharges
  payment: CourierPayment
  paymentWord: string | null // Leopards' own status word, e.g. "Pending"
  invoiceNo: string | null // invoice that pays the COD
  invoiceDate: string | null // yyyy-mm-dd
  chargeInvoiceNo: string | null // invoice that took the charges (often an earlier one)
  invoiceReceived: boolean // that COD invoice's money has reached us
  paymentMethod: string | null // e.g. IBFT
  message: string | null // e.g. "Invoice not generated yet."
  weightGrams: number | null
}

const num = (v: unknown) => {
  const n = parseFloat(String(v ?? ''))
  return isNaN(n) ? 0 : n
}
const str = (v: unknown) => (typeof v === 'string' && v.trim() ? v.trim() : null)
const round2 = (n: number) => Math.round(n * 100) / 100
const differs = (a: number | null | undefined, b: number | null | undefined) => Math.abs((a ?? 0) - (b ?? 0)) >= 0.005 || (a == null) !== (b == null)
const ymd = (d: Date) => d.toISOString().slice(0, 10)
const PAID_WORD = /^(paid|payment\s*paid|paid\s*out|settled|cleared|transferred)$/i

// Saved breakdowns from before tax / invoices were tracked get the missing fields
export function normalizeMoney(raw: unknown): CourierMoney {
  const m = (raw || {}) as Partial<CourierMoney>
  const gross = m.grossCharges ?? 0
  const extra = m.extraCharges ?? 0
  const wht = m.whtAmount ?? 0
  return {
    ...(m as CourierMoney),
    grossCharges: gross,
    extraCharges: extra,
    totalCharges: m.totalCharges ?? round2(gross + extra),
    whtPercent: m.whtPercent ?? 0,
    whtAmount: wht,
    payout: m.payout ?? round2((m.cod ?? 0) - wht - gross - extra),
    invoiceNo: m.invoiceNo ?? null,
    chargeInvoiceNo: m.chargeInvoiceNo !== undefined ? m.chargeInvoiceNo : m.invoiceNo ?? null,
    invoiceReceived: m.invoiceReceived ?? false,
  }
}

export async function getWhtPercent(): Promise<number> {
  const row = await prisma.appSetting.findUnique({ where: { key: WHT_KEY } }).catch(() => null)
  const n = row ? parseFloat(row.value) : NaN
  return isNaN(n) || n < 0 || n > 50 ? DEFAULT_WHT_PERCENT : n
}
export async function setWhtPercent(percent: number) {
  await prisma.appSetting.upsert({ where: { key: WHT_KEY }, create: { key: WHT_KEY, value: String(percent) }, update: { value: String(percent) } })
}

async function callLeopards(api: string, params: Record<string, string>): Promise<any> {
  const qs = new URLSearchParams({ api_key: API_KEY, api_password: API_PASSWORD, ...params })
  const res = await fetch(`${BASE}/${api}/format/json/?${qs}`, { cache: 'no-store', signal: AbortSignal.timeout(20000) })
  return res.json()
}

// Leopards' payment wording → our state. Only a clear "Paid" counts as paid.
export function classifyPayment(p: any): CourierPayment {
  const word = String(p?.status ?? '').trim()
  if (!word) return p?.invoice_cheque_no ? 'PENDING' : 'NOT_INVOICED'
  if (PAID_WORD.test(word)) return 'PAID'
  if (/pending|unpaid|process/i.test(word)) return 'PENDING'
  return word // something new from Leopards: shown as-is, never treated as paid
}

// ── Step 1: Leopards API ─────────────────────────────────────────────────────────────────────

interface ParcelMoney {
  cn: string
  cod: number
  charges: any // raw getShippingCharges row
  payment: any // raw getPaymentDetails row
}

async function fetchParcels(cnList: string[]): Promise<Map<string, ParcelMoney>> {
  const out = new Map<string, ParcelMoney>()
  const cns = Array.from(new Set(cnList.map(normalizeCN).filter(isLeopardsCN)))
  for (let i = 0; i < cns.length; i += BATCH) {
    const batch = cns.slice(i, i + BATCH).join(',')
    const [charges, payments] = await Promise.all([
      callLeopards('getShippingCharges', { cn_numbers: batch }),
      callLeopards('getPaymentDetails', { cn_numbers: batch }),
    ])
    const payByCn = new Map<string, any>()
    for (const p of Array.isArray(payments?.payment_list) ? payments.payment_list : []) payByCn.set(normalizeCN(p.booked_packet_cn), p)
    for (const c of Array.isArray(charges?.data) ? charges.data : []) {
      const cn = normalizeCN(c.cn_number)
      out.set(cn, { cn, cod: num(c.booked_packet_collect_amount), charges: c, payment: payByCn.get(cn) })
    }
  }
  return out
}

interface RawInvoice {
  invoiceNo: string
  invoiceDate: Date | null
  amount: number
  bankName: string | null
  method: string | null
  status: string | null
}

async function fetchInvoices(): Promise<RawInvoice[]> {
  const start = new Date(Date.now() - INVOICE_LOOKBACK_DAYS * 86400000)
  const res = await callLeopards('getInvoices', { start_date: ymd(start), end_date: ymd(new Date(Date.now() + 86400000)) })
  if (!Array.isArray(res?.data)) return []
  return res.data
    .map((r: any) => {
      const date = str(r.invoice_cheque_date)
      return {
        invoiceNo: str(r.invoice_cheque_no) || '',
        invoiceDate: date ? new Date(`${date}T12:00:00+05:00`) : null,
        amount: num(r.invoice_cheque_amount),
        bankName: str(r.bank_name),
        method: str(r.payment_method_name),
        status: str(r.pay_status_name),
      }
    })
    .filter((r: RawInvoice) => r.invoiceNo)
}

// The money breakdown of one parcel from Leopards' rows (before the invoice check of step 2)
function buildMoney(p: ParcelMoney, delivered: boolean, whtPercent: number, invoiceReceived: (no: string | null) => boolean, prev: CourierMoney | null): CourierMoney {
  const c = p.charges
  const pay = p.payment
  const gross = round2(num(c.gross_charges))
  // Leopards pays the COD in invoice_cheque_no; if it took the charges earlier, that one is old_invoice_no
  const invoiceNo = str(c.invoice_cheque_no) || str(pay?.invoice_cheque_no)
  const chargeInvoiceNo = str(c.old_invoice_no) || invoiceNo
  const codInvoiceNo = delivered ? invoiceNo : null
  const wht = delivered ? round2((p.cod * whtPercent) / 100) : 0
  const extra = prev && prev.chargeInvoiceNo === chargeInvoiceNo ? prev.extraCharges || 0 : 0
  const received = invoiceReceived(codInvoiceNo)
  return {
    cod: p.cod,
    shipmentCharges: num(c.shipment_charges),
    cashHandling: num(c.cash_handling_charges),
    insurance: num(c.insurance_charges),
    fuelPercent: num(c.fuel_surcharge_percentage),
    fuelAmount: round2(num(c.fuel_surcharge_amount)),
    returnCharges: num(c.return_charges),
    otherCharges: num(c.osa_charges),
    gstPercent: num(c.gst),
    gstAmount: round2(num(c.gst_amount)),
    netCharges: round2(num(c.net_charges)),
    grossCharges: gross,
    extraCharges: extra,
    totalCharges: round2(gross + extra),
    whtPercent: delivered ? whtPercent : 0,
    whtAmount: wht,
    payout: round2(p.cod - wht - gross - extra),
    payment: received ? 'PAID' : classifyPayment(pay),
    paymentWord: str(pay?.status),
    invoiceNo: codInvoiceNo,
    invoiceDate: codInvoiceNo ? str(pay?.invoice_cheque_date) || str(c.invoice_cheque_date) : null,
    chargeInvoiceNo,
    invoiceReceived: received,
    paymentMethod: str(pay?.payment_method),
    message: str(pay?.message),
    weightGrams: c.weight_charged != null ? num(c.weight_charged) : null,
  }
}

export interface MoneySyncSummary {
  checked: number // parcels asked
  invoices: number // Leopards invoices seen
  paid: number[] // order numbers marked Received (their invoice money arrived)
  alerted?: number // orders in the owners' payment alert (invoiced / paid since last check)
}

const leopardsWhere = (since: Date) => ({
  trackingNumber: { not: null },
  status: { in: ['PACKING', 'DISPATCHED', 'DELIVERED', 'RETURNED'] as OrderStatus[] },
  createdAt: { gte: since },
})

export async function syncLeopardsMoney(): Promise<MoneySyncSummary> {
  const summary: MoneySyncSummary = { checked: 0, invoices: 0, paid: [] }
  if (!leopardsEnabled()) return summary

  // Invoices first: their amounts are the real money
  const invoices = await fetchInvoices()
  summary.invoices = invoices.length
  for (const inv of invoices) {
    const old = await prisma.leopardsInvoice.findUnique({ where: { invoiceNo: inv.invoiceNo } })
    const leopardsPaid = !!inv.status && PAID_WORD.test(inv.status)
    const wasPaid = !!old?.leopardsStatus && PAID_WORD.test(old.leopardsStatus)
    const data = {
      invoiceDate: inv.invoiceDate,
      amount: inv.amount,
      bankName: inv.bankName,
      method: inv.method,
      leopardsStatus: inv.status,
      // Leopards now says paid and nobody marked it yet → received (once; an undo in the app stays)
      ...(leopardsPaid && !wasPaid && !old?.receivedAt ? { receivedAt: inv.invoiceDate || new Date(), markedBy: null } : {}),
    }
    await prisma.leopardsInvoice.upsert({ where: { invoiceNo: inv.invoiceNo }, create: { invoiceNo: inv.invoiceNo, ...data }, update: data })
  }
  const received = new Set(
    (await prisma.leopardsInvoice.findMany({ where: { receivedAt: { not: null } }, select: { invoiceNo: true } })).map((i) => i.invoiceNo)
  )
  const whtPercent = await getWhtPercent()

  // Every booked Leopards parcel (charges can be taken before delivery)
  const since = new Date(Date.now() - LOOKBACK_DAYS * 86400000)
  const sales = await prisma.sale.findMany({ where: leopardsWhere(since), orderBy: { createdAt: 'asc' } })
  const byCn = groupByCn(sales)
  if (byCn.size === 0) return summary

  const parcels = await fetchParcels(Array.from(byCn.keys()))
  summary.checked = parcels.size
  const personName = new Map((await prisma.person.findMany({ select: { id: true, name: true } })).map((p) => [p.id, p.name]))
  const alerts: PaymentChange[] = [] // invoiced / paid since the last check → owners' WhatsApp alert
  const logs: LogEntry[] = []

  for (const [cn, p] of Array.from(parcels.entries())) {
    const rows = byCn.get(cn) || []
    if (!rows.length) continue
    const lead = rows[0]
    const delivered = lead.status === 'DELIVERED'
    const prev = lead.courierMoney ? normalizeMoney(lead.courierMoney) : null
    const m = buildMoney(p, delivered, whtPercent, (no) => !!no && received.has(no), prev)

    if (delivered) {
      if (lead.courierPayment !== m.payment && (m.payment === 'PENDING' || m.payment === 'PAID') && !m.invoiceReceived) {
        alerts.push({
          orderNo: lead.orderNo,
          customer: lead.customerName,
          payout: m.payout,
          cod: m.cod,
          charges: round2(m.totalCharges + m.whtAmount),
          payment: m.payment,
          invoiceNo: m.invoiceNo,
          invoiceDate: m.invoiceDate,
          method: m.paymentMethod,
          receivedBy: lead.receivedById ? personName.get(lead.receivedById) || null : null,
        })
      }
      // Order history: first money details, and every change of Leopards' payment state
      if (lead.courierPayment !== m.payment || lead.courierPayout == null) {
        const words: Record<string, string> = { NOT_INVOICED: 'not invoiced yet', PENDING: 'invoiced, not paid yet', PAID: 'paid' }
        const inv = m.invoiceNo ? ` · invoice ${m.invoiceNo}${m.invoiceDate ? ` (${m.invoiceDate})` : ''}` : ''
        logs.push({
          ...orderRef(rows),
          action: 'leopards_money',
          message: `Leopards money: COD ${rs(m.cod)} − tax ${rs(m.whtAmount)} − charges ${rs(m.totalCharges)} = ${rs(m.payout)} to you · ${words[m.payment] || m.payment}${inv}`,
          actor: LEOPARDS,
          details: { from: lead.courierPayment, to: m.payment, cod: m.cod, tax: m.whtAmount, charges: m.totalCharges, payout: m.payout, invoiceNo: m.invoiceNo },
        })
      }
    }

    await prisma.sale.updateMany({
      where: { id: { in: rows.map((r) => r.id) } },
      data: {
        courierCod: m.cod,
        courierCharges: m.totalCharges,
        courierPayout: delivered ? m.payout : null,
        courierPayment: m.payment,
        courierMoney: m as any,
        courierMoneyAt: new Date(),
        courierInvoiceNo: m.invoiceNo,
      },
    })
  }
  await logOrder(logs)

  const settled = await settleLeopardsMoney()
  summary.paid = settled.paid

  summary.alerted = alerts.length
  await sendPaymentAlert(alerts)

  console.log(`Leopards money: ${summary.checked} parcel(s), ${summary.invoices} invoice(s), ${summary.paid.length} marked Received, ${alerts.length} alerted`)
  return summary
}

function groupByCn<T extends { trackingNumber: string | null }>(sales: T[]): Map<string, T[]> {
  const byCn = new Map<string, T[]>()
  for (const s of sales) {
    const cn = normalizeCN(s.trackingNumber)
    if (isLeopardsCN(cn)) byCn.set(cn, [...(byCn.get(cn) || []), s])
  }
  return byCn
}

// ── Step 2: settle (database only) ───────────────────────────────────────────────────────────

export interface InvoiceBreakdown {
  invoiceNo: string
  amount: number
  codOrders: { orderNo: number | null; cn: string; cod: number; tax: number }[] // COD paid in this invoice
  chargeOrders: { orderNo: number | null; cn: string; charges: number; returned: boolean; codLater: boolean }[] // charges taken here
  expected: number // Σ (COD − tax) − Σ API charges
  extra: number // amount Leopards cut beyond the API charges (spread as extra charges)
}

// Per invoice: what it pays and takes, from the parcels saved by step 1
export function breakdownInvoices(
  invoices: { invoiceNo: string; amount: number }[],
  parcels: { cn: string; orderNo: number | null; status: string; m: CourierMoney }[]
): Map<string, InvoiceBreakdown> {
  const out = new Map<string, InvoiceBreakdown>()
  for (const inv of invoices) {
    out.set(inv.invoiceNo, { invoiceNo: inv.invoiceNo, amount: inv.amount, codOrders: [], chargeOrders: [], expected: 0, extra: 0 })
  }
  for (const p of parcels) {
    const codInv = p.status === 'DELIVERED' ? p.m.invoiceNo : null
    const c = codInv ? out.get(codInv) : null
    if (c) c.codOrders.push({ orderNo: p.orderNo, cn: p.cn, cod: p.m.cod, tax: p.m.whtAmount })
    const ch = p.m.chargeInvoiceNo ? out.get(p.m.chargeInvoiceNo) : null
    if (ch) ch.chargeOrders.push({ orderNo: p.orderNo, cn: p.cn, charges: p.m.grossCharges, returned: p.status === 'RETURNED', codLater: p.status !== 'RETURNED' && codInv !== p.m.chargeInvoiceNo })
  }
  for (const b of Array.from(out.values())) {
    b.expected = round2(b.codOrders.reduce((a, o) => a + o.cod - o.tax, 0) - b.chargeOrders.reduce((a, o) => a + o.charges, 0))
    b.extra = round2(b.expected - b.amount) // > 0: Leopards cut more than the API charges
  }
  return out
}

export interface SettleSummary {
  paid: number[] // order numbers marked Received
}

// Applies the invoices to the orders: extra charges, money to you, profit, return loss, and Received
// for orders whose invoice money has arrived. Safe to run any time; writes only what changed.
export async function settleLeopardsMoney(): Promise<SettleSummary> {
  const summary: SettleSummary = { paid: [] }
  const invoices = await prisma.leopardsInvoice.findMany()
  const sales = await prisma.sale.findMany({
    where: { courierMoneyAt: { not: null }, trackingNumber: { not: null }, status: { not: 'CANCELLED' } },
    orderBy: { createdAt: 'asc' },
  })
  const byCn = groupByCn(sales)
  const parcels = Array.from(byCn.entries()).map(([cn, rows]) => ({ cn, rows, orderNo: rows[0].orderNo, status: rows[0].status, m: normalizeMoney(rows[0].courierMoney) }))
  const breakdown = breakdownInvoices(invoices, parcels)

  // Spread each invoice's extra over the parcels whose charges it took (by their API charges)
  const extraByCn = new Map<string, number>()
  for (const b of Array.from(breakdown.values())) {
    if (Math.abs(b.extra) < 0.005 || !b.chargeOrders.length) continue
    const shares = splitByWeight(b.extra, b.chargeOrders.map((o) => o.charges || 1))
    b.chargeOrders.forEach((o, i) => extraByCn.set(o.cn, round2((extraByCn.get(o.cn) || 0) + shares[i])))
  }

  // Default receiver of an invoice's money: whoever most of its orders go to
  const invoiceByNo = new Map(invoices.map((i) => [i.invoiceNo, i]))
  for (const inv of invoices) {
    if (!inv.receivedAt || inv.receivedById) continue
    const counts = new Map<string, number>()
    for (const p of parcels) if (p.status === 'DELIVERED' && p.m.invoiceNo === inv.invoiceNo && p.rows[0].receivedById) counts.set(p.rows[0].receivedById, (counts.get(p.rows[0].receivedById) || 0) + 1)
    const best = Array.from(counts.entries()).sort((a, b) => b[1] - a[1])[0]?.[0] || null
    if (best) {
      inv.receivedById = best
      await prisma.leopardsInvoice.update({ where: { invoiceNo: inv.invoiceNo }, data: { receivedById: best } })
    }
  }

  const logs: LogEntry[] = []
  for (const p of parcels) {
    const { rows, m: old } = p
    const delivered = p.status === 'DELIVERED'
    const extra = extraByCn.get(p.cn) || 0
    const inv = delivered && old.invoiceNo ? invoiceByNo.get(old.invoiceNo) : undefined
    const m: CourierMoney = {
      ...old,
      extraCharges: extra,
      totalCharges: round2(old.grossCharges + extra),
      payout: round2(old.cod - old.whtAmount - old.grossCharges - extra),
      invoiceReceived: !!inv?.receivedAt,
      payment: inv?.receivedAt ? 'PAID' : old.payment === 'PAID' && old.invoiceReceived ? 'PENDING' : old.payment,
    }

    // Is this parcel's money kept in step automatically?
    const handDC = rows.some((r) => r.deliveryCharge > 0)
    const managed = !handDC && rows.every((r) => r.paymentStatus !== 'NOT_APPLICABLE' && (r.courierMoneyAuto || r.paymentStatus === 'NOT_RECEIVED'))
    const weights = rows.map(saleTotal)
    const payoutShares = splitByWeight(m.payout, weights)
    const lossShares = splitByWeight(m.totalCharges, weights)
    const markPaid = delivered && managed && m.cod > 0 && !!inv?.receivedAt && rows.some((r) => r.paymentStatus === 'NOT_RECEIVED')

    for (const [i, r] of rows.entries()) {
      const data: Record<string, any> = {}
      if (differs(r.courierCharges, m.totalCharges)) data.courierCharges = m.totalCharges
      if (delivered && differs(r.courierPayout, m.payout)) data.courierPayout = m.payout
      if (r.courierPayment !== m.payment) data.courierPayment = m.payment
      const oldM = (r.courierMoney || {}) as Partial<CourierMoney>
      if (oldM.extraCharges !== m.extraCharges || oldM.payout !== m.payout || oldM.invoiceReceived !== m.invoiceReceived || oldM.payment !== m.payment || oldM.chargeInvoiceNo === undefined)
        data.courierMoney = m as any

      if (managed && delivered && m.cod > 0) {
        // Money to you (expected until the invoice arrives) → profit
        const profit = round2(deliveredProfit({ ...r, receivedAmount: payoutShares[i] }))
        if (differs(r.receivedAmount, payoutShares[i]) || !r.courierMoneyAuto || differs(r.profit, profit)) {
          data.receivedAmount = payoutShares[i]
          data.courierMoneyAuto = true
          data.profit = profit
        }
        if (markPaid && r.paymentStatus === 'NOT_RECEIVED') {
          data.paymentStatus = 'RECEIVED'
          data.paymentReceivedAt = inv!.receivedAt
          if (inv!.receivedById) data.receivedById = inv!.receivedById
        }
      } else if (!handDC && p.status === 'RETURNED' && (r.courierMoneyAuto || r.returnLoss < 0.005) && m.totalCharges > 0) {
        // Returned: Leopards' charges are the loss
        if (differs(r.returnLoss, lossShares[i]) || !r.courierMoneyAuto) {
          data.returnLoss = lossShares[i]
          data.profit = -lossShares[i]
          data.courierMoneyAuto = true
        }
      }
      if (Object.keys(data).length) await prisma.sale.update({ where: { id: r.id }, data })
    }

    if (markPaid) {
      if (p.orderNo != null) summary.paid.push(p.orderNo)
      logs.push({
        ...orderRef(rows),
        action: 'leopards_paid',
        message: `Leopards invoice ${old.invoiceNo} received · ${rs(m.payout)} (COD ${rs(m.cod)} − tax ${rs(m.whtAmount)} − charges ${rs(m.totalCharges)}) → payment marked Received`,
        actor: LEOPARDS,
        details: { invoiceNo: old.invoiceNo, cod: m.cod, tax: m.whtAmount, charges: m.totalCharges, payout: m.payout },
      })
    }
  }
  await logOrder(logs)
  return summary
}

// Leopards money of all parcels, for the invoices page
export async function loadInvoiceView() {
  const [invoices, sales] = await Promise.all([
    prisma.leopardsInvoice.findMany({ orderBy: [{ invoiceDate: 'desc' }, { invoiceNo: 'desc' }], include: { receivedBy: { select: { id: true, name: true } } } }),
    prisma.sale.findMany({
      where: { courierMoneyAt: { not: null }, trackingNumber: { not: null }, status: { not: 'CANCELLED' } },
      select: { id: true, orderNo: true, trackingNumber: true, status: true, customerName: true, city: true, paymentStatus: true, receivedById: true, receivedAmount: true, soldPrice: true, quantity: true, courierMoney: true },
      orderBy: { createdAt: 'asc' },
    }),
  ])
  const byCn = groupByCn(sales)
  const parcels = Array.from(byCn.entries()).map(([cn, rows]) => ({ cn, rows, orderNo: rows[0].orderNo, status: rows[0].status, m: normalizeMoney(rows[0].courierMoney) }))
  return { invoices, parcels, breakdown: breakdownInvoices(invoices, parcels) }
}
