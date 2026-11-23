import { NextResponse } from 'next/server'
import { loadInvoiceView, getWhtPercent } from '@/lib/leopardsMoney'

export const dynamic = 'force-dynamic'

// Leopards payments (invoices) with what each one paid and took, for Payments → Leopards payments
export async function GET() {
  try {
    const [{ invoices, parcels, breakdown }, whtPercent] = await Promise.all([loadInvoiceView(), getWhtPercent()])
    const parcelByCn = new Map(parcels.map((p) => [p.cn, p]))

    const list = invoices.map((inv) => {
      const b = breakdown.get(inv.invoiceNo)!
      // Suggested account for "Money received": where most of its orders' money goes
      const counts = new Map<string, number>()
      for (const o of b.codOrders) {
        const id = parcelByCn.get(o.cn)?.rows[0].receivedById
        if (id) counts.set(id, (counts.get(id) || 0) + 1)
      }
      const suggestedPersonId = Array.from(counts.entries()).sort((x, y) => y[1] - x[1])[0]?.[0] || null
      return {
        suggestedPersonId,
        invoiceNo: inv.invoiceNo,
        invoiceDate: inv.invoiceDate,
        amount: inv.amount,
        bankName: inv.bankName,
        method: inv.method,
        leopardsStatus: inv.leopardsStatus,
        receivedAt: inv.receivedAt,
        receivedBy: inv.receivedBy,
        markedBy: inv.markedBy,
        extra: b.extra,
        paid: b.codOrders.map((o) => {
          const p = parcelByCn.get(o.cn)!
          return {
            orderNo: o.orderNo,
            customer: p.rows[0].customerName,
            city: p.rows[0].city,
            cod: o.cod,
            tax: o.tax,
            charges: p.m.chargeInvoiceNo === inv.invoiceNo ? p.m.totalCharges : 0, // taken in this invoice too
            payout: p.m.payout,
            received: p.rows.every((r) => r.paymentStatus === 'RECEIVED'),
          }
        }),
        took: b.chargeOrders
          .filter((o) => !b.codOrders.some((c) => c.cn === o.cn))
          .map((o) => {
            const p = parcelByCn.get(o.cn)!
            return {
              orderNo: o.orderNo,
              customer: p.rows[0].customerName,
              city: p.rows[0].city,
              charges: p.m.totalCharges,
              returned: o.returned,
              codInvoiceNo: p.status === 'DELIVERED' ? p.m.invoiceNo : null,
            }
          }),
      }
    })

    // Delivered orders Leopards has not put in an invoice yet (money still to come)
    const waiting = parcels
      .filter((p) => p.status === 'DELIVERED' && !p.m.invoiceNo && p.m.cod > 0)
      .map((p) => ({
        orderNo: p.orderNo,
        customer: p.rows[0].customerName,
        city: p.rows[0].city,
        cod: p.m.cod,
        tax: p.m.whtAmount,
        charges: p.m.totalCharges,
        chargesTaken: !!p.m.chargeInvoiceNo,
        payout: p.m.payout,
      }))

    return NextResponse.json({ invoices: list, waiting, whtPercent })
  } catch (error: any) {
    console.error('Leopards invoices error:', error)
    return NextResponse.json({ error: error.message || 'Could not load Leopards payments' }, { status: 500 })
  }
}
