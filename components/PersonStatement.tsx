'use client'

import React, { useEffect, useMemo, useState } from 'react'
import { createPortal } from 'react-dom'
import { X, Loader2, Download, ShoppingBag, Receipt, ArrowDownToLine, Truck, Boxes, Flag, PiggyBank, SlidersHorizontal, Trash2, Wallet, Send, HandCoins } from 'lucide-react'
import { toast } from 'sonner'

// A person's "In hand" statement: opening balance, every amount in / out with the running balance,
// and the closing balance (= the In hand number on their card).

type Kind = 'order' | 'expense' | 'withdrawal' | 'dc' | 'stock' | 'opening' | 'investment' | 'adjustment' | 'courier' | 'supplier' | 'transfer' | 'advance'
interface Entry {
  id: string
  date: string
  kind: Kind
  amount: number
  title: string
  detail: string
  orderNo?: number | null
  refId?: string
  balance: number
}
interface Statement {
  person: { id: string; name: string }
  opening: number
  entries: Entry[]
  totals: { in: number; out: number; byKind: Record<Kind, { count: number; amount: number }> }
  closing: number
  inHandNow: number
}

const KIND: Record<Kind, { label: string; icon: React.ElementType; tone: string }> = {
  order: { label: 'Order received', icon: ShoppingBag, tone: 'bg-emerald-100 text-emerald-700' },
  expense: { label: 'Expense', icon: Receipt, tone: 'bg-orange-100 text-orange-700' },
  withdrawal: { label: 'Withdrawal', icon: ArrowDownToLine, tone: 'bg-rose-100 text-rose-700' },
  dc: { label: 'Delivery charge', icon: Truck, tone: 'bg-sky-100 text-sky-700' },
  stock: { label: 'Stock bought', icon: Boxes, tone: 'bg-teal-100 text-teal-700' },
  opening: { label: 'Opening balance', icon: Flag, tone: 'bg-violet-100 text-violet-700' },
  investment: { label: 'Investment', icon: PiggyBank, tone: 'bg-emerald-100 text-emerald-800' },
  adjustment: { label: 'Adjustment', icon: SlidersHorizontal, tone: 'bg-amber-100 text-amber-800' },
  advance: { label: 'Supplier advance', icon: HandCoins, tone: 'bg-indigo-100 text-indigo-700' },
  courier: { label: 'Leopards invoice', icon: Truck, tone: 'bg-yellow-100 text-yellow-800' },
  supplier: { label: 'Supplier paid', icon: Wallet, tone: 'bg-orange-100 text-orange-800' },
  transfer: { label: 'Sent / received', icon: Send, tone: 'bg-sky-100 text-sky-800' },
}

const rs = (n: number) => `Rs. ${Math.round(n).toLocaleString('en-PK')}`
const signed = (n: number) => `${n >= 0 ? '+' : '−'} ${rs(Math.abs(n))}`
const toISO = (d: Date) => `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, '0')}-${String(d.getDate()).padStart(2, '0')}`

export default function PersonStatement({
  personId,
  name,
  initialFrom,
  initialTo,
  onClose,
}: {
  personId: string
  name: string
  initialFrom?: string
  initialTo?: string
  onClose: () => void
}) {
  const [from, setFrom] = useState(initialFrom || '')
  const [to, setTo] = useState(initialTo || '')
  const [data, setData] = useState<Statement | null>(null)
  const [error, setError] = useState('')
  const [kind, setKind] = useState<Kind | 'all'>('all')
  const [mounted, setMounted] = useState(false)
  const closeRef = React.useRef(onClose)
  closeRef.current = onClose

  useEffect(() => {
    setMounted(true)
    const onKey = (e: KeyboardEvent) => e.key === 'Escape' && closeRef.current()
    window.addEventListener('keydown', onKey)
    return () => window.removeEventListener('keydown', onKey)
  }, [])

  const [reload, setReload] = useState(0)
  useEffect(() => {
    const qs = new URLSearchParams()
    if (from) qs.set('from', from)
    if (to) qs.set('to', to)
    setData(null)
    setError('')
    fetch(`/api/people/${personId}/ledger?${qs}`)
      .then(async (r) => {
        const d = await r.json()
        if (!r.ok) throw new Error(d.error || 'Could not load the statement')
        setData(d)
      })
      .catch((e) => setError(e.message))
  }, [personId, from, to, reload])

  // Remove a wrong opening balance / investment / adjustment
  const deleteEntry = async (e: Entry) => {
    if (!confirm(`Delete "${e.title}" ${e.amount >= 0 ? '+' : '−'}${rs(Math.abs(e.amount))}?`)) return
    const res = await fetch(e.kind === 'transfer' ? `/api/transfers/${e.refId}` : e.kind === 'advance' ? `/api/supplier-advances/${e.refId}` : `/api/money-entries/${e.refId}`, { method: 'DELETE' })
    const d = await res.json().catch(() => ({}))
    if (!res.ok) return toast.error(d.error || 'Could not delete')
    toast.success('Deleted')
    setReload((n) => n + 1)
  }

  const shown = useMemo(() => (data ? data.entries.filter((e) => kind === 'all' || e.kind === kind) : []), [data, kind])

  const quick = (label: string, f: string, t: string) => (
    <button
      key={label}
      onClick={() => {
        setFrom(f)
        setTo(t)
      }}
      className={`rounded-lg px-2.5 py-1 text-[11px] font-semibold ${from === f && to === t ? 'bg-violet-600 text-white' : 'bg-slate-100 text-slate-600 hover:bg-slate-200'}`}
    >
      {label}
    </button>
  )
  const now = new Date()
  const monthStart = toISO(new Date(now.getFullYear(), now.getMonth(), 1))
  const lastStart = toISO(new Date(now.getFullYear(), now.getMonth() - 1, 1))
  const lastEnd = toISO(new Date(now.getFullYear(), now.getMonth(), 0))

  const downloadCsv = () => {
    if (!data) return
    const esc = (v: unknown) => `"${String(v ?? '').replace(/"/g, '""')}"`
    const rows = [
      ['Date', 'Type', 'What', 'Details', 'In', 'Out', 'Balance'],
      ['', '', 'Opening balance', '', '', '', data.opening.toFixed(2)],
      ...[...data.entries].reverse().map((e) => [
        new Date(e.date).toLocaleString('en-GB'),
        KIND[e.kind].label,
        e.title,
        e.detail,
        e.amount > 0 ? e.amount.toFixed(2) : '',
        e.amount < 0 ? (-e.amount).toFixed(2) : '',
        e.balance.toFixed(2),
      ]),
      ['', '', 'Closing balance', '', data.totals.in.toFixed(2), (-data.totals.out).toFixed(2), data.closing.toFixed(2)],
    ]
    const blob = new Blob([rows.map((r) => r.map(esc).join(',')).join('\n')], { type: 'text/csv' })
    const a = document.createElement('a')
    a.href = URL.createObjectURL(blob)
    a.download = `${name}-in-hand-statement${from ? `-${from}` : ''}${to ? `-to-${to}` : ''}.csv`
    a.click()
    URL.revokeObjectURL(a.href)
  }

  if (!mounted) return null
  return createPortal(
    <div className="fixed inset-0 z-[100] flex items-end sm:items-center justify-center bg-slate-900/40 sm:p-4" onClick={onClose}>
      <div onClick={(e) => e.stopPropagation()} className="flex w-full sm:max-w-3xl max-h-[94vh] flex-col overflow-hidden rounded-t-2xl sm:rounded-2xl bg-white shadow-xl">
        {/* Header */}
        <div className="flex items-center gap-2 border-b border-slate-100 px-4 py-3">
          <div>
            <h2 className="text-sm font-bold text-slate-900">{name} · In hand statement</h2>
            <p className="text-[11px] text-slate-500">Every amount added to or taken from {name}&apos;s business money, with the balance after each</p>
          </div>
          <button onClick={downloadCsv} disabled={!data} className="ml-auto flex items-center gap-1 rounded-lg border border-slate-200 px-2.5 py-1.5 text-[11px] font-semibold text-slate-600 hover:bg-slate-50 disabled:opacity-40">
            <Download className="h-3.5 w-3.5" /> CSV
          </button>
          <button onClick={onClose} className="rounded-lg p-1.5 text-slate-400 hover:bg-slate-100 hover:text-slate-700" aria-label="Close">
            <X className="h-4 w-4" />
          </button>
        </div>

        {/* Period */}
        <div className="flex flex-wrap items-center gap-1.5 border-b border-slate-100 px-4 py-2">
          {quick('This month', monthStart, toISO(now))}
          {quick('Last month', lastStart, lastEnd)}
          {quick('All time', '', '')}
          <span className="ml-auto flex items-center gap-1 text-[11px] text-slate-500">
            <input type="date" value={from} onChange={(e) => setFrom(e.target.value)} className="rounded-md border border-slate-200 px-1.5 py-1" />
            to
            <input type="date" value={to} onChange={(e) => setTo(e.target.value)} className="rounded-md border border-slate-200 px-1.5 py-1" />
          </span>
        </div>

        <div className="flex-1 overflow-y-auto px-4 py-3">
          {error && <p className="rounded-lg border border-rose-200 bg-rose-50 p-3 text-sm text-rose-700">{error}</p>}
          {!data && !error && (
            <div className="flex justify-center py-10 text-slate-400">
              <Loader2 className="h-5 w-5 animate-spin" />
            </div>
          )}

          {data && (
            <>
              {/* Opening → in → out → closing */}
              <div className="grid grid-cols-2 sm:grid-cols-4 gap-2">
                <div className="rounded-xl border border-slate-200 p-2.5">
                  <div className="text-[10px] uppercase text-slate-500">Opening balance</div>
                  <div className="font-mono font-bold text-slate-800">{rs(data.opening)}</div>
                </div>
                <div className="rounded-xl border border-emerald-200 bg-emerald-50/50 p-2.5">
                  <div className="text-[10px] uppercase text-emerald-700">Money in</div>
                  <div className="font-mono font-bold text-emerald-700">+ {rs(data.totals.in)}</div>
                </div>
                <div className="rounded-xl border border-rose-200 bg-rose-50/50 p-2.5">
                  <div className="text-[10px] uppercase text-rose-700">Money out</div>
                  <div className="font-mono font-bold text-rose-700">− {rs(Math.abs(data.totals.out))}</div>
                </div>
                <div className="rounded-xl border border-violet-200 bg-violet-50 p-2.5">
                  <div className="text-[10px] uppercase text-violet-700">Closing balance</div>
                  <div className={`font-mono font-black ${data.closing < 0 ? 'text-rose-600' : 'text-violet-800'}`}>{rs(data.closing)}</div>
                </div>
              </div>
              <p className="mt-1 text-[11px] text-slate-400">
                {rs(data.opening)} + {rs(data.totals.in)} − {rs(Math.abs(data.totals.out))} = {rs(data.closing)}
                {to || from ? ` · In hand now (all time): ${rs(data.inHandNow)}` : ''}
              </p>

              {/* Breakdown / filter */}
              <div className="mt-3 flex flex-wrap gap-1.5">
                <button
                  onClick={() => setKind('all')}
                  className={`rounded-lg border px-2.5 py-1 text-[11px] font-semibold ${kind === 'all' ? 'border-slate-800 bg-slate-800 text-white' : 'border-slate-200 text-slate-600'}`}
                >
                  All ({data.entries.length})
                </button>
                {(Object.keys(KIND) as Kind[])
                  .filter((k) => data.totals.byKind[k].count > 0)
                  .map((k) => (
                    <button
                      key={k}
                      onClick={() => setKind(k)}
                      className={`rounded-lg border px-2.5 py-1 text-[11px] font-semibold ${kind === k ? 'border-slate-800 bg-slate-800 text-white' : 'border-slate-200 text-slate-600'}`}
                    >
                      {KIND[k].label} ({data.totals.byKind[k].count}) {signed(data.totals.byKind[k].amount)}
                    </button>
                  ))}
              </div>

              {/* Entries, newest first */}
              <div className="mt-3 overflow-x-auto rounded-xl border border-slate-200">
                <table className="w-full min-w-[640px] text-left text-xs">
                  <thead>
                    <tr className="bg-slate-50 text-[10px] uppercase tracking-wider text-slate-500 border-b border-slate-200">
                      <th className="px-3 py-2">Date</th>
                      <th className="px-2 py-2">What</th>
                      <th className="px-2 py-2 text-right">In</th>
                      <th className="px-2 py-2 text-right">Out</th>
                      <th className="px-3 py-2 text-right">Balance</th>
                    </tr>
                  </thead>
                  <tbody>
                    {shown.map((e, i) => {
                      const k = KIND[e.kind]
                      const Icon = k.icon
                      return (
                        <tr key={e.id} className={`border-b border-slate-100 align-top ${i % 2 ? 'bg-slate-50/70' : ''}`}>
                          <td className="px-3 py-2 whitespace-nowrap text-slate-500">
                            {new Date(e.date).toLocaleDateString('en-GB', { day: 'numeric', month: 'short', year: '2-digit' })}
                            <div className="text-[10px] text-slate-400">{new Date(e.date).toLocaleTimeString('en-GB', { hour: '2-digit', minute: '2-digit' })}</div>
                          </td>
                          <td className="px-2 py-2">
                            <div className="flex items-start gap-1.5">
                              <span className={`mt-0.5 flex h-5 w-5 shrink-0 items-center justify-center rounded-full ${k.tone}`}>
                                <Icon className="h-3 w-3" />
                              </span>
                              <div className="min-w-0">
                                <div className="font-semibold text-slate-800">{e.title}</div>
                                {e.detail && <div className="text-[11px] text-slate-500">{e.detail}</div>}
                                {(e.kind === 'opening' || e.kind === 'investment' || e.kind === 'adjustment' || e.kind === 'transfer' || e.kind === 'advance') && e.refId && (
                                  <button
                                    onClick={() => deleteEntry(e)}
                                    className="mt-0.5 inline-flex items-center gap-0.5 text-[10px] font-semibold text-slate-400 hover:text-rose-600"
                                  >
                                    <Trash2 className="h-3 w-3" /> Delete
                                  </button>
                                )}
                              </div>
                            </div>
                          </td>
                          <td className="px-2 py-2 text-right font-mono font-semibold text-emerald-600 whitespace-nowrap">{e.amount > 0 ? `+ ${rs(e.amount)}` : ''}</td>
                          <td className="px-2 py-2 text-right font-mono font-semibold text-rose-600 whitespace-nowrap">{e.amount < 0 ? `− ${rs(-e.amount)}` : ''}</td>
                          <td className={`px-3 py-2 text-right font-mono font-bold whitespace-nowrap ${e.balance < 0 ? 'text-rose-600' : 'text-slate-900'}`}>{rs(e.balance)}</td>
                        </tr>
                      )
                    })}
                    {kind === 'all' && (
                      <tr className="bg-slate-100">
                        <td className="px-3 py-2 text-slate-500" colSpan={4}>
                          Opening balance{from ? ` (before ${new Date(from).toLocaleDateString('en-GB', { day: 'numeric', month: 'short', year: 'numeric' })})` : ''}
                        </td>
                        <td className="px-3 py-2 text-right font-mono font-bold">{rs(data.opening)}</td>
                      </tr>
                    )}
                  </tbody>
                </table>
                {shown.length === 0 && <p className="py-6 text-center text-sm text-slate-500">No money in or out in this period.</p>}
              </div>
              {kind !== 'all' && <p className="mt-1 text-[11px] text-slate-400">Showing one type only; the Balance column is still the full running balance.</p>}
            </>
          )}
        </div>
      </div>
    </div>,
    document.body
  )
}
