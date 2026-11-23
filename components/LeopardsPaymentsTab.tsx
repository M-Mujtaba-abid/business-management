'use client'

import React, { useCallback, useEffect, useState } from 'react'
import { Truck, CheckCircle2, Clock, RefreshCw, Undo2, ChevronDown, ChevronUp, Info } from 'lucide-react'
import { toast } from 'sonner'

// Payments → Leopards payments: every Leopards invoice with its exact amount (= what reaches the
// bank), the orders it paid and the charges it took. "Money received" marks its orders Received.

interface PaidOrder {
  orderNo: number | null
  customer: string
  city: string
  cod: number
  tax: number
  charges: number
  payout: number
  received: boolean
}
interface TookOrder {
  orderNo: number | null
  customer: string
  city: string
  charges: number
  returned: boolean
  codInvoiceNo: string | null
}
interface Invoice {
  invoiceNo: string
  invoiceDate: string | null
  amount: number
  bankName: string | null
  method: string | null
  leopardsStatus: string | null
  receivedAt: string | null
  receivedBy: { id: string; name: string } | null
  suggestedPersonId: string | null
  markedBy: string | null
  extra: number
  paid: PaidOrder[]
  took: TookOrder[]
}
interface Waiting {
  orderNo: number | null
  customer: string
  city: string
  cod: number
  tax: number
  charges: number
  chargesTaken: boolean
  payout: number
}
interface Data {
  invoices: Invoice[]
  waiting: Waiting[]
  whtPercent: number
}

const rs = (n: number) => `Rs. ${Math.round(n).toLocaleString('en-PK')}`
const fmtDate = (iso: string | null) =>
  iso ? new Date(iso).toLocaleDateString('en-GB', { day: 'numeric', month: 'short', year: 'numeric' }) : '—'
const todayISO = () => {
  const d = new Date()
  return `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, '0')}-${String(d.getDate()).padStart(2, '0')}`
}
const ord = (n: number | null) => (n != null ? `#${n}` : '—')

export default function LeopardsPaymentsTab({ onChanged, refreshKey }: { onChanged?: () => void; refreshKey?: number }) {
  const [data, setData] = useState<Data | null>(null)
  const [people, setPeople] = useState<{ id: string; name: string }[]>([])
  const [loading, setLoading] = useState(true)
  const [checking, setChecking] = useState(false)
  const [busy, setBusy] = useState<string | null>(null)
  const [open, setOpen] = useState<Record<string, boolean>>({})
  const [form, setForm] = useState<{ invoiceNo: string; personId: string; date: string } | null>(null)

  const load = useCallback(() => {
    setLoading(true)
    Promise.all([fetch('/api/leopards/invoices').then((r) => r.json()), fetch('/api/people').then((r) => r.json())])
      .then(([d, p]) => {
        if (d && Array.isArray(d.invoices)) setData(d)
        else if (d?.error) toast.error(d.error)
        if (Array.isArray(p)) setPeople(p)
      })
      .catch(() => toast.error('Could not load Leopards payments'))
      .finally(() => setLoading(false))
  }, [])

  useEffect(() => {
    load()
  }, [load, refreshKey])

  const check = async () => {
    setChecking(true)
    try {
      const res = await fetch('/api/leopards/sync', { method: 'POST' })
      const s = await res.json()
      if (!res.ok) throw new Error(s.error || 'Leopards check failed')
      toast.success(`Checked with Leopards${s.paid?.length ? ` · Received: #${s.paid.join(', #')}` : ''}`)
      load()
      onChanged?.()
    } catch (e: any) {
      toast.error(e.message)
    } finally {
      setChecking(false)
    }
  }

  const markReceived = async () => {
    if (!form) return
    setBusy(form.invoiceNo)
    try {
      const res = await fetch(`/api/leopards/invoices/${encodeURIComponent(form.invoiceNo)}`, {
        method: 'PATCH',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ received: true, receivedById: form.personId, date: form.date }),
      })
      const r = await res.json()
      if (!res.ok) throw new Error(r.error || 'Failed')
      toast.success(`Invoice ${form.invoiceNo} received${r.paid?.length ? ` · orders #${r.paid.join(', #')} marked Received` : ''}`)
      setForm(null)
      load()
      onChanged?.()
    } catch (e: any) {
      toast.error(e.message)
    } finally {
      setBusy(null)
    }
  }

  const undo = async (inv: Invoice) => {
    if (!confirm(`Set invoice ${inv.invoiceNo} (${rs(inv.amount)}) back to NOT received? Its orders go back to Not received.`)) return
    setBusy(inv.invoiceNo)
    try {
      const res = await fetch(`/api/leopards/invoices/${encodeURIComponent(inv.invoiceNo)}`, {
        method: 'PATCH',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ received: false }),
      })
      const r = await res.json()
      if (!res.ok) throw new Error(r.error || 'Failed')
      toast.success(`Invoice ${inv.invoiceNo} set back to not received`)
      load()
      onChanged?.()
    } catch (e: any) {
      toast.error(e.message)
    } finally {
      setBusy(null)
    }
  }

  const invoices = data?.invoices || []
  const notReceived = invoices.filter((i) => !i.receivedAt)
  const toCome = notReceived.reduce((a, i) => a + i.amount, 0)
  const waitingTotal = (data?.waiting || []).reduce((a, w) => a + w.cod - w.tax - (w.chargesTaken ? 0 : w.charges), 0)

  return (
    <div className="bg-white border border-slate-200 rounded-2xl p-5 shadow-sm space-y-4">
      <div className="flex flex-wrap items-start justify-between gap-3">
        <div>
          <h2 className="text-base font-bold text-slate-900 flex items-center gap-2">
            <Truck className="h-5 w-5 text-amber-600" /> Leopards payments
          </h2>
          <p className="text-xs text-slate-500">
            Each invoice is one payment from Leopards: the exact amount that reaches the bank. Press <b>Money received</b> when it
            arrives.
          </p>
        </div>
        <div className="flex items-center gap-3">
          <div className="text-right">
            <div className="text-[11px] text-slate-500">Invoiced, not received</div>
            <div className="text-lg font-black font-mono text-amber-600">{rs(toCome)}</div>
          </div>
          <button
            onClick={check}
            disabled={checking}
            className="flex items-center gap-1.5 rounded-lg border border-slate-200 px-3 py-2 text-xs font-semibold text-slate-700 hover:bg-slate-50 disabled:opacity-50"
          >
            <RefreshCw className={`h-3.5 w-3.5 ${checking ? 'animate-spin' : ''}`} /> {checking ? 'Checking…' : 'Check Leopards'}
          </button>
        </div>
      </div>

      <div className="flex gap-2 rounded-xl border border-slate-200 bg-slate-50 p-3 text-[11px] text-slate-600">
        <Info className="h-4 w-4 shrink-0 text-slate-400" />
        <span>
          Money to you per order = COD − tax ({data?.whtPercent ?? 4}% of COD: income tax + sales tax) − Leopards charges (delivery,
          fuel, GST). Leopards often takes a parcel&apos;s charges in one invoice and pays its COD in a later one, so an invoice is
          not always the sum of its orders. The app keeps the difference, so In hand always matches the bank.
        </span>
      </div>

      {loading && !data ? (
        <div className="space-y-2">
          {[0, 1].map((i) => (
            <div key={i} className="h-20 rounded-xl bg-slate-100/60 animate-pulse" />
          ))}
        </div>
      ) : invoices.length === 0 ? (
        <p className="rounded-xl border border-dashed border-slate-200 p-6 text-center text-xs text-slate-500">
          No Leopards invoices yet. Press Check Leopards to load them.
        </p>
      ) : (
        <div className="space-y-3">
          {invoices.map((inv) => {
            const isOpen = open[inv.invoiceNo] ?? !inv.receivedAt
            const editing = form?.invoiceNo === inv.invoiceNo
            const paidSum = inv.paid.reduce((a, o) => a + o.cod - o.tax - o.charges, 0)
            const tookSum = inv.took.reduce((a, o) => a + o.charges, 0)
            return (
              <div key={inv.invoiceNo} className={`rounded-xl border ${inv.receivedAt ? 'border-emerald-200 bg-emerald-50/40' : 'border-amber-200 bg-amber-50/40'}`}>
                <div className="flex flex-wrap items-center gap-3 p-3">
                  <button onClick={() => setOpen({ ...open, [inv.invoiceNo]: !isOpen })} className="flex min-w-0 flex-1 items-center gap-2 text-left">
                    {isOpen ? <ChevronUp className="h-4 w-4 text-slate-400" /> : <ChevronDown className="h-4 w-4 text-slate-400" />}
                    <div className="min-w-0">
                      <div className="font-mono text-sm font-bold text-slate-900">{inv.invoiceNo}</div>
                      <div className="text-[11px] text-slate-500">
                        {fmtDate(inv.invoiceDate)}
                        {inv.bankName ? ` · ${inv.bankName}` : ''}
                        {inv.method ? ` · ${inv.method}` : ''}
                        {inv.leopardsStatus ? ` · Leopards: ${inv.leopardsStatus}` : ''}
                      </div>
                    </div>
                  </button>
                  <div className="text-right">
                    <div className="font-mono text-lg font-black text-slate-900">{rs(inv.amount)}</div>
                    {inv.receivedAt ? (
                      <div className="flex items-center justify-end gap-1 text-[11px] font-semibold text-emerald-700">
                        <CheckCircle2 className="h-3.5 w-3.5" /> Received {fmtDate(inv.receivedAt)}
                        {inv.receivedBy ? ` → ${inv.receivedBy.name}` : ''}
                      </div>
                    ) : (
                      <div className="flex items-center justify-end gap-1 text-[11px] font-semibold text-amber-700">
                        <Clock className="h-3.5 w-3.5" /> Not received yet
                      </div>
                    )}
                  </div>
                  <div className="flex gap-2">
                    {inv.receivedAt ? (
                      <button
                        onClick={() => undo(inv)}
                        disabled={busy === inv.invoiceNo}
                        className="flex items-center gap-1 rounded-lg border border-slate-200 bg-white px-2.5 py-1.5 text-[11px] font-semibold text-slate-600 hover:bg-slate-50 disabled:opacity-50"
                      >
                        <Undo2 className="h-3.5 w-3.5" /> Undo
                      </button>
                    ) : (
                      !editing && (
                        <button
                          onClick={() => setForm({ invoiceNo: inv.invoiceNo, personId: inv.receivedBy?.id || inv.suggestedPersonId || people[0]?.id || '', date: todayISO() })}
                          className="rounded-lg bg-emerald-500 px-3 py-1.5 text-[11px] font-bold text-white hover:bg-emerald-600"
                        >
                          Money received
                        </button>
                      )
                    )}
                  </div>
                </div>

                {editing && form && (
                  <div className="flex flex-wrap items-end gap-2 border-t border-amber-200 bg-white/70 p-3">
                    <label className="text-[11px] text-slate-600">
                      Came to whose account
                      <select
                        value={form.personId}
                        onChange={(e) => setForm({ ...form, personId: e.target.value })}
                        className="mt-1 block rounded-lg border border-slate-200 px-2 py-1.5 text-xs"
                      >
                        {people.map((p) => (
                          <option key={p.id} value={p.id}>
                            {p.name}
                          </option>
                        ))}
                      </select>
                    </label>
                    <label className="text-[11px] text-slate-600">
                      Date
                      <input
                        type="date"
                        value={form.date}
                        max={todayISO()}
                        onChange={(e) => setForm({ ...form, date: e.target.value })}
                        className="mt-1 block rounded-lg border border-slate-200 px-2 py-1.5 text-xs"
                      />
                    </label>
                    <button
                      onClick={markReceived}
                      disabled={busy === inv.invoiceNo || !form.personId}
                      className="rounded-lg bg-emerald-500 px-3 py-2 text-xs font-bold text-white hover:bg-emerald-600 disabled:opacity-50"
                    >
                      {busy === inv.invoiceNo ? 'Saving…' : `Yes, ${rs(inv.amount)} received`}
                    </button>
                    <button onClick={() => setForm(null)} className="rounded-lg px-3 py-2 text-xs font-semibold text-slate-500 hover:bg-slate-100">
                      Cancel
                    </button>
                  </div>
                )}

                {isOpen && (
                  <div className="space-y-3 border-t border-slate-200/70 p-3 text-xs">
                    {inv.paid.length > 0 && (
                      <div>
                        <div className="mb-1 font-semibold text-slate-700">Orders paid in this invoice</div>
                        <div className="overflow-x-auto">
                          <table className="w-full min-w-[460px]">
                            <thead className="text-[10px] uppercase text-slate-400">
                              <tr>
                                <th className="py-1 text-left font-semibold">Order</th>
                                <th className="py-1 text-right font-semibold">COD</th>
                                <th className="py-1 text-right font-semibold">Tax</th>
                                <th className="py-1 text-right font-semibold">Charges here</th>
                                <th className="py-1 text-right font-semibold">Net</th>
                              </tr>
                            </thead>
                            <tbody className="divide-y divide-slate-100">
                              {inv.paid.map((o, i) => (
                                <tr key={i}>
                                  <td className="py-1.5 text-slate-700">
                                    <span className="font-mono font-semibold">{ord(o.orderNo)}</span> {o.customer}
                                    <span className="text-slate-400">, {o.city}</span>
                                    {o.received && <CheckCircle2 className="ml-1 inline h-3 w-3 text-emerald-600" />}
                                  </td>
                                  <td className="py-1.5 text-right font-mono">{rs(o.cod)}</td>
                                  <td className="py-1.5 text-right font-mono text-rose-600">− {rs(o.tax)}</td>
                                  <td className="py-1.5 text-right font-mono text-rose-600">{o.charges ? `− ${rs(o.charges)}` : '—'}</td>
                                  <td className="py-1.5 text-right font-mono font-semibold">{rs(o.cod - o.tax - o.charges)}</td>
                                </tr>
                              ))}
                            </tbody>
                          </table>
                        </div>
                      </div>
                    )}
                    {inv.took.length > 0 && (
                      <div>
                        <div className="mb-1 font-semibold text-slate-700">Charges taken here for other orders</div>
                        <ul className="space-y-1">
                          {inv.took.map((o, i) => (
                            <li key={i} className="flex justify-between gap-2">
                              <span className="text-slate-700">
                                <span className="font-mono font-semibold">{ord(o.orderNo)}</span> {o.customer}
                                <span className="text-slate-400">, {o.city}</span>
                                <span className="ml-1 text-[10px] text-slate-500">
                                  {o.returned ? '(returned: this is the loss)' : o.codInvoiceNo ? `(COD paid in ${o.codInvoiceNo})` : '(COD comes in a later invoice)'}
                                </span>
                              </span>
                              <span className="font-mono text-rose-600">− {rs(o.charges)}</span>
                            </li>
                          ))}
                        </ul>
                      </div>
                    )}
                    <div className="flex justify-between border-t border-slate-200 pt-2 font-semibold text-slate-800">
                      <span>
                        {rs(paidSum)} {tookSum ? `− ${rs(tookSum)}` : ''} = invoice
                      </span>
                      <span className="font-mono">{rs(inv.amount)}</span>
                    </div>
                    {Math.abs(inv.extra) >= 1 && (
                      <p className="text-[11px] text-slate-500">
                        Leopards cut {rs(Math.abs(inv.extra))} {inv.extra > 0 ? 'more' : 'less'} than its parcel charges show (fuel surcharge etc.). It is
                        included in the charges above.
                      </p>
                    )}
                  </div>
                )}
              </div>
            )
          })}
        </div>
      )}

      {data && data.waiting.length > 0 && (
        <div className="rounded-xl border border-slate-200 p-3 text-xs">
          <div className="mb-1 flex justify-between font-semibold text-slate-700">
            <span>Delivered, not in an invoice yet</span>
            <span className="font-mono">≈ {rs(waitingTotal)}</span>
          </div>
          <ul className="space-y-1">
            {data.waiting.map((w, i) => (
              <li key={i} className="flex justify-between gap-2">
                <span className="text-slate-700">
                  <span className="font-mono font-semibold">{ord(w.orderNo)}</span> {w.customer}
                  <span className="text-slate-400">, {w.city}</span>
                  <span className="ml-1 text-[10px] text-slate-500">
                    COD {rs(w.cod)} − tax {rs(w.tax)}
                    {w.chargesTaken ? ' (charges already taken)' : ` − charges ${rs(w.charges)}`}
                  </span>
                </span>
                <span className="font-mono">{rs(w.cod - w.tax - (w.chargesTaken ? 0 : w.charges))}</span>
              </li>
            ))}
          </ul>
        </div>
      )}
    </div>
  )
}
