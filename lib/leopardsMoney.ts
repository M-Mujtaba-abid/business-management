// Leopards money per parcel (server only).
//   getShippingCharges  → cash collected (COD) and every charge Leopards deducts
//   getPaymentDetails   → whether Leopards has paid it: "Invoice not generated yet" → "Pending"
//                         (invoice made, money not sent) → "Paid"
// An order is marked Received ONLY when Leopards says Paid. Until then it stays Not received;
// the expected payout is shown in the Leopards column.
import prisma from '@/lib/prisma'
import { leopardsEnabled, normalizeCN, isLeopardsCN } from '@/lib/leopards'
import { deliveredProfit, saleTotal, splitByWeight } from '@/lib/saleMoney'
import { LEOPARDS, logOrder, orderRef, rs } from '@/lib/orderLog'

const BASE = 'https://merchantapi.leopardscourier.com/api'
const API_KEY = process.env.LEOPARDS_API_KEY || ''
const API_PASSWORD = process.env.LEOPARDS_API_PASSWORD || ''
const BATCH = 50 // Leopards allows 50 CN numbers per call
const LOOKBACK_DAYS = 120

export type CourierPayment = 'NOT_INVOICED' | 'PENDING' | 'PAID' | string

// Saved in Sale.courierMoney and shown in the popup. Never holds Leopards' slip link
// (it carries our API key and password).
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
  grossCharges: number // everything deducted
  payout: number // cod - grossCharges
  payment: CourierPayment
  paymentWord: string | null // Leopards' own status word, e.g. "Pending"
  invoiceNo: string | null
  invoiceDate: string | null // yyyy-mm-dd
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

async function callLeopards(api: string, cns: string[]): Promise<any> {
  const qs = new URLSearchParams({ api_key: API_KEY, api_password: API_PASSWORD, cn_numbers: cns.join(',') })
  const res = await fetch(`${BASE}/${api}/format/json/?${qs}`, { cache: 'no-store', signal: AbortSignal.timeout(20000) })
  return res.json()
}

// Leopards' payment wording → our state. Only a clear "Paid" counts as paid.
export function classifyPayment(p: any): CourierPayment {
  const word = String(p?.status ?? '').trim()
  if (!word) return p?.invoice_cheque_no ? 'PENDING' : 'NOT_INVOICED'
  if (/^(paid|payment\s*paid|paid\s*out|settled|cleared)$/i.test(word)) return 'PAID'
  if (/pending|unpaid|process/i.test(word)) return 'PENDING'
  return word // something new from Leopards: shown as-is, never treated as paid
}

export async function fetchLeopardsMoney(cnList: string[]): Promise<Map<string, CourierMoney>> {
  const out = new Map<string, CourierMoney>()
  const cns = Array.from(new Set(cnList.map(normalizeCN).filter(isLeopardsCN)))
  if (!leopardsEnabled() || cns.length === 0) return out

  for (let i = 0; i < cns.length; i += BATCH) {
    const batch = cns.slice(i, i + BATCH)
    const [charges, payments] = await Promise.all([
      callLeopards('getShippingCharges', batch),
      callLeopards('getPaymentDetails', batch),
    ])
    const payByCn = new Map<string, any>()
    for (const p of Array.isArray(payments?.payment_list) ? payments.payment_list : []) {
      payByCn.set(normalizeCN(p.booked_packet_cn), p)
    }
    for (const c of Array.isArray(charges?.data) ? charges.data : []) {
      const cn = normalizeCN(c.cn_number)
      const p = payByCn.get(cn)
      const cod = num(c.booked_packet_collect_amount)
      const gross = round2(num(c.gross_charges))
      out.set(cn, {
        cod,
        shipmentCharges: num(c.shipment_charges),
        cashHandling: num(c.cash_handling_charges),
        insurance: num(c.insurance_charges),
        fuelPercent: num(c.fuel_surcharge_percentage),
        fuelAmount: num(c.fuel_surcharge_amount),
        returnCharges: num(c.return_charges),
        otherCharges: num(c.osa_charges),
        gstPercent: num(c.gst),
        gstAmount: round2(num(c.gst_amount)),
        netCharges: round2(num(c.net_charges)),
        grossCharges: gross,
        payout: round2(cod - gross),
        payment: classifyPayment(p),
        paymentWord: str(p?.status),
        invoiceNo: str(p?.invoice_cheque_no) || str(c.invoice_cheque_no),
        invoiceDate: str(p?.invoice_cheque_date) || str(c.invoice_cheque_date),
        paymentMethod: str(p?.payment_method),
        message: str(p?.message),
        weightGrams: c.weight_charged != null ? num(c.weight_charged) : null,
      })
    }
  }
  return out
}

export interface MoneySyncSummary {
  checked: number // parcels asked
  paid: number[] // order numbers marked Received because Leopards paid them
}

// Delivered Leopards orders not yet received: save the money breakdown, and mark Received
// only the ones Leopards has PAID (amount = the real payout, split over a parcel's products).
export async function syncLeopardsMoney(): Promise<MoneySyncSummary> {
  const summary: MoneySyncSummary = { checked: 0, paid: [] }
  if (!leopardsEnabled()) return summary

  const since = new Date(Date.now() - LOOKBACK_DAYS * 24 * 60 * 60 * 1000)
  const sales = await prisma.sale.findMany({
    where: {
      status: 'DELIVERED',
      paymentStatus: 'NOT_RECEIVED',
      trackingNumber: { not: null },
      createdAt: { gte: since },
    },
    orderBy: { createdAt: 'asc' },
  })
  const byCn = new Map<string, typeof sales>()
  for (const s of sales) {
    const cn = normalizeCN(s.trackingNumber)
    if (isLeopardsCN(cn)) byCn.set(cn, [...(byCn.get(cn) || []), s])
  }
  if (byCn.size === 0) return summary

  const money = await fetchLeopardsMoney(Array.from(byCn.keys()))
  summary.checked = money.size

  for (const [cn, m] of Array.from(money.entries())) {
    const rows = byCn.get(cn) || []
    if (!rows.length) continue
    const now = new Date()
    const base = {
      courierCod: m.cod,
      courierCharges: m.grossCharges,
      courierPayout: m.payout,
      courierPayment: m.payment,
      courierMoney: m as any,
      courierMoneyAt: now,
    }

    // Order history: first money details, and every change of Leopards' payment state
    const prev = rows[0].courierPayment
    if (prev !== m.payment || rows[0].courierPayout == null || Math.abs((rows[0].courierPayout ?? 0) - m.payout) >= 0.5) {
      const words: Record<string, string> = { NOT_INVOICED: 'not invoiced yet', PENDING: 'invoiced, not paid yet', PAID: 'PAID' }
      const state = words[m.payment] || m.payment
      const inv = m.invoiceNo ? ` · invoice ${m.invoiceNo}${m.invoiceDate ? ` (${m.invoiceDate})` : ''}` : ''
      await logOrder({
        ...orderRef(rows),
        action: m.payment === 'PAID' ? 'leopards_paid' : 'leopards_money',
        message:
          m.payment === 'PAID'
            ? `Leopards paid ${rs(m.payout)}${inv} → payment marked Received`
            : `Leopards money: COD ${rs(m.cod)} − charges ${rs(m.grossCharges)} = ${rs(m.payout)} to you · ${state}${inv}`,
        actor: LEOPARDS,
        details: { from: prev, to: m.payment, cod: m.cod, charges: m.grossCharges, payout: m.payout, invoiceNo: m.invoiceNo, invoiceDate: m.invoiceDate },
      })
    }

    if (m.payment !== 'PAID') {
      await prisma.sale.updateMany({ where: { id: { in: rows.map((r) => r.id) } }, data: base })
      continue
    }

    // Leopards has paid: mark Received with the real amount
    const shares = splitByWeight(m.payout, rows.map(saleTotal))
    const paidAt = m.invoiceDate ? new Date(`${m.invoiceDate}T12:00:00+05:00`) : now
    await prisma.$transaction(
      rows.map((r, i) => {
        const receivedAmount = Math.abs(shares[i] - saleTotal(r)) < 0.005 ? null : shares[i]
        return prisma.sale.update({
          where: { id: r.id },
          data: {
            ...base,
            paymentStatus: 'RECEIVED',
            paymentReceivedAt: isNaN(paidAt.getTime()) ? now : paidAt,
            receivedAmount,
            profit: deliveredProfit({ ...r, receivedAmount }),
          },
        })
      })
    )
    if (rows[0].orderNo != null) summary.paid.push(rows[0].orderNo)
  }
  console.log(`Leopards money: ${summary.checked} parcel(s) checked, ${summary.paid.length} paid → Received`)
  return summary
}
