'use client'

import React, { useEffect, useState } from 'react'
import { createPortal } from 'react-dom'
import { X, Loader2 } from 'lucide-react'

// Payments card → click "Supplier money" or "Own money": what that number is made of.

type Mode = 'supplier' | 'own'
interface SupplierLine {
  group: 'unpaid' | 'payback' | 'advance' | 'transfer'
  orderNo: number | null
  customer: string
  supplier: string
  amount: number
  date: string | null
  note: string
  covered?: number | null // unpaid only: part of the cover cost that is in hand now
}
interface OwnLine {
  date: string
  kind: string
  title: string
  detail: string
  amount: number
}
interface Data {
  person: { id: string; name: string }
  inHand: number
  supplier: { total: number; listed: number; lines: SupplierLine[] }
  own: { total: number; lines: OwnLine[] }
}

const rs = (n: number) => `Rs. ${Math.round(n).toLocaleString('en-PK')}`
const day = (d: string | null) => (d ? new Date(d).toLocaleDateString('en-GB', { day: 'numeric', month: 'short' }) : '')

const GROUPS: { key: SupplierLine['group']; title: string; help: string; tone: string }[] = [
  { key: 'unpaid', title: 'Suppliers still to pay', help: 'Order money is with you; the supplier is not paid yet.', tone: 'text-amber-800 bg-amber-50 border-amber-200' },
  { key: 'payback', title: 'Paid by someone else — send it to them', help: 'Order money is with you, but the other person paid the supplier.', tone: 'text-sky-800 bg-sky-50 border-sky-200' },
  { key: 'advance', title: 'You paid the supplier — comes back to you', help: 'You paid; the order money is not with you yet (not received, or with the other person).', tone: 'text-violet-800 bg-violet-50 border-violet-200' },
  { key: 'transfer', title: 'Moved with Send money', help: 'Supplier money inside transfers between you.', tone: 'text-slate-700 bg-slate-50 border-slate-200' },
]

export default function MoneySplitDialog({
  personId,
  name,
  mode: initialMode,
  onClose,
  onOpenOrder,
}: {
  personId: string
  name: string
  mode: Mode
  onClose: () => void
  onOpenOrder?: (orderNo: number) => void // open the order in the Orders page with its drawer
}) {
  const [mode, setMode] = useState<Mode>(initialMode)
  const [data, setData] = useState<Data | null>(null)
  const [error, setError] = useState('')
  const [mounted, setMounted] = useState(false)
  const closeRef = React.useRef(onClose)
  closeRef.current = onClose

  useEffect(() => {
    setMounted(true)
    fetch(`/api/people/${personId}/money-split`)
      .then(async (r) => {
        const d = await r.json()
        if (!r.ok) throw new Error(d.error || 'Could not load')
        setData(d)
      })
      .catch((e) => setError(e.message))
    const onKey = (e: KeyboardEvent) => e.key === 'Escape' && closeRef.current()
    window.addEventListener('keydown', onKey)
    return () => window.removeEventListener('keydown', onKey)
  }, [personId])

  if (!mounted) return null
  return createPortal(
    <div className="fixed inset-0 z-[110] flex items-end sm:items-center justify-center bg-slate-900/40 sm:p-4" onClick={onClose}>
      <div onClick={(e) => e.stopPropagation()} className="flex w-full sm:max-w-2xl max-h-[92vh] flex-col overflow-hidden rounded-t-2xl sm:rounded-2xl bg-white shadow-xl">
        <div className="flex items-center gap-2 border-b border-slate-100 px-4 py-3">
          <h2 className="text-sm font-bold text-slate-900">{name} · what is in hand</h2>
          <button onClick={onClose} className="ml-auto rounded-lg p-1.5 text-slate-400 hover:bg-slate-100" aria-label="Close">
            <X className="h-4 w-4" />
          </button>
        </div>

        {/* Tabs: Supplier money / Own money */}
        <div className="grid grid-cols-2 gap-2 border-b border-slate-100 p-3">
          {(['supplier', 'own'] as const).map((m) => (
            <button
              key={m}
              onClick={() => setMode(m)}
              className={`rounded-xl border px-3 py-2 text-left ${
                mode === m ? (m === 'supplier' ? 'border-amber-400 bg-amber-50' : 'border-emerald-400 bg-emerald-50') : 'border-slate-200'
              }`}
            >
              <div className={`text-[11px] ${m === 'supplier' ? 'text-amber-700' : 'text-emerald-700'}`}>{m === 'supplier' ? 'Supplier money' : 'Own money'}</div>
              <div className="font-mono text-base font-black text-slate-900">{data ? rs(m === 'supplier' ? data.supplier.total : data.own.total) : '…'}</div>
            </button>
          ))}
        </div>

        <div className="flex-1 overflow-y-auto p-4">
          {error && <p className="rounded-lg border border-rose-200 bg-rose-50 p-3 text-sm text-rose-700">{error}</p>}
          {!data && !error && (
            <div className="flex justify-center py-10 text-slate-400">
              <Loader2 className="h-5 w-5 animate-spin" />
            </div>
          )}

          {data && mode === 'supplier' && (
            <div className="space-y-3">
              {data.supplier.lines.length === 0 && <p className="py-6 text-center text-sm text-slate-500">No supplier money with {name}.</p>}
              {GROUPS.map((g) => {
                const list = data.supplier.lines.filter((l) => l.group === g.key)
                if (!list.length) return null
                const total = list.reduce((a, l) => a + l.amount, 0)
                return (
                  <div key={g.key} className={`rounded-xl border ${g.tone}`}>
                    <div className="flex items-center px-3 py-2">
                      <div>
                        <div className="text-xs font-bold">
                          {g.title} ({list.length})
                        </div>
                        <div className="text-[10px] opacity-80">{g.help}</div>
                      </div>
                      <div className="ml-auto font-mono text-sm font-black">{total >= 0 ? '' : '−'}{rs(Math.abs(total))}</div>
                    </div>
                    {g.key === 'unpaid' && (
                      <div className="flex flex-wrap gap-x-3 gap-y-0.5 px-3 pb-1.5 text-[10px]">
                        <span className="flex items-center gap-1 text-emerald-700">
                          <span className="h-2 w-2 rounded-full bg-emerald-500" /> money is with you — pay this supplier from it
                        </span>
                        <span className="flex items-center gap-1 text-amber-700">
                          <span className="h-2 w-2 rounded-full bg-amber-400" /> money already used — will come from own money
                        </span>
                      </div>
                    )}
                    <ul className="divide-y divide-white/70 bg-white/60 text-xs">
                      {list.map((l, i) => {
                        // unpaid: green when the money for it is in hand, yellow when it was already used
                        const full = l.group === 'unpaid' && (l.covered ?? 0) >= l.amount - 0.5
                        const part = l.group === 'unpaid' && !full && (l.covered ?? 0) > 0
                        const rowTone = full ? 'bg-emerald-50' : part ? 'bg-emerald-50/50' : ''
                        const clickable = l.orderNo != null && !!onOpenOrder
                        return (
                          <li
                            key={i}
                            onClick={() => clickable && onOpenOrder!(l.orderNo as number)}
                            className={`flex items-center gap-2 px-3 py-1.5 ${rowTone} ${clickable ? 'cursor-pointer hover:bg-white' : ''}`}
                            title={clickable ? `Open order #${l.orderNo}` : undefined}
                          >
                            {l.group === 'unpaid' && (
                              <span className={`h-2 w-2 shrink-0 rounded-full ${full ? 'bg-emerald-500' : part ? 'bg-emerald-300' : 'bg-amber-400'}`} />
                            )}
                            {l.orderNo != null && <span className="font-mono font-bold text-slate-500 underline decoration-dotted">#{l.orderNo}</span>}
                            <span className="min-w-0 flex-1 truncate">
                              <span className="font-semibold text-slate-800">{l.customer}</span>
                              {l.supplier && <span className="text-slate-500"> · {l.supplier}</span>}
                              <span className="text-slate-400">
                                {' '}
                                ·{' '}
                                {full
                                  ? 'money in hand — pay the supplier'
                                  : part
                                  ? `${rs(l.covered ?? 0)} of it in hand`
                                  : l.group === 'unpaid'
                                  ? 'money already used — pay from own money'
                                  : l.note}
                              </span>
                            </span>
                            <span className="shrink-0 text-[10px] text-slate-400">{day(l.date)}</span>
                            <span className={`shrink-0 font-mono font-semibold ${l.amount < 0 ? 'text-violet-700' : full || part ? 'text-emerald-700' : 'text-slate-900'}`}>
                              {l.amount < 0 ? '−' : ''}
                              {rs(Math.abs(l.amount))}
                            </span>
                          </li>
                        )
                      })}
                    </ul>
                  </div>
                )
              })}
              {data.supplier.lines.length > 0 && (
                <p className="text-right text-[11px] text-slate-500">
                  Total of the lists: <b className="font-mono">{rs(data.supplier.listed)}</b> = Supplier money
                </p>
              )}
            </div>
          )}

          {data && mode === 'own' && (
            <div>
              <p className="mb-2 text-[11px] text-slate-500">
                Own money = In hand {rs(data.inHand)} − supplier money. Each line shows how much it added to or took from own money (newest first).
              </p>
              <ul className="divide-y divide-slate-100 rounded-xl border border-slate-200 text-xs">
                {data.own.lines.map((l, i) => (
                  <li key={i} className="flex items-start gap-2 px-3 py-1.5">
                    <span className="w-14 shrink-0 text-slate-400">{day(l.date)}</span>
                    <span className="min-w-0 flex-1">
                      <span className="font-semibold text-slate-800">{l.title}</span>
                      {l.detail && <span className="block truncate text-[11px] text-slate-500">{l.detail}</span>}
                    </span>
                    <span className={`shrink-0 font-mono font-semibold ${l.amount >= 0 ? 'text-emerald-600' : 'text-rose-600'}`}>
                      {l.amount >= 0 ? '+' : '−'} {rs(Math.abs(l.amount))}
                    </span>
                  </li>
                ))}
              </ul>
              {data.own.lines.length === 0 && <p className="py-6 text-center text-sm text-slate-500">Nothing yet.</p>}
            </div>
          )}
        </div>
      </div>
    </div>,
    document.body
  )
}
