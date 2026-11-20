'use client'

import React, { useCallback, useEffect, useState } from 'react'
import { AlertTriangle, CheckCircle2, ChevronDown, ArrowRight, Loader2, RefreshCw, Info } from 'lucide-react'

// Dashboard: everything stuck or waiting, most urgent first. Each line opens the matching orders.

type Severity = 'high' | 'medium' | 'info'
interface Item {
  key: string
  title: string
  hint: string
  severity: Severity
  count: number
  amount?: number
  orders?: { orderNo: number | null; saleId: string; customer: string; amount: number; detail: string }[]
  open: { section: string; attention?: string }
}

const TONE: Record<Severity, { row: string; dot: string; label: string }> = {
  high: { row: 'border-rose-200 bg-rose-50/60', dot: 'bg-rose-500', label: 'Urgent' },
  medium: { row: 'border-amber-200 bg-amber-50/60', dot: 'bg-amber-500', label: 'Soon' },
  info: { row: 'border-slate-200 bg-slate-50', dot: 'bg-sky-500', label: 'To do' },
}
const rs = (n: number) => `Rs. ${Math.round(n).toLocaleString('en-PK')}`

export default function NeedsAttention({ onOpen, refreshKey }: { onOpen: (open: Item['open']) => void; refreshKey?: number }) {
  const [items, setItems] = useState<Item[] | null>(null)
  const [error, setError] = useState('')
  const [openKey, setOpenKey] = useState<string | null>(null)
  const [loading, setLoading] = useState(false)

  const load = useCallback(() => {
    setLoading(true)
    setError('')
    fetch('/api/attention')
      .then(async (r) => {
        const d = await r.json()
        if (!r.ok) throw new Error(d.error || 'Could not load')
        setItems(d.items)
      })
      .catch((e) => setError(e.message))
      .finally(() => setLoading(false))
  }, [])
  useEffect(load, [load, refreshKey])

  const urgent = items?.filter((i) => i.severity === 'high').length || 0

  return (
    <section className="rounded-2xl border border-slate-200 bg-white shadow-sm">
      <div className="flex items-center gap-2 border-b border-slate-100 px-4 py-3">
        {items && items.length === 0 ? <CheckCircle2 className="h-5 w-5 text-emerald-600" /> : <AlertTriangle className="h-5 w-5 text-amber-500" />}
        <div>
          <h2 className="text-sm font-bold text-slate-900">Needs attention</h2>
          <p className="text-[11px] text-slate-500">
            {items == null ? 'Checking…' : items.length === 0 ? 'All clear — nothing is stuck right now' : `${items.length} thing${items.length > 1 ? 's' : ''} to look at${urgent ? ` · ${urgent} urgent` : ''}`}
          </p>
        </div>
        <button onClick={load} className="ml-auto rounded-lg p-1.5 text-slate-400 hover:bg-slate-100 hover:text-slate-700" title="Check again">
          {loading ? <Loader2 className="h-4 w-4 animate-spin" /> : <RefreshCw className="h-4 w-4" />}
        </button>
      </div>

      {error && <p className="m-3 rounded-lg border border-rose-200 bg-rose-50 p-2 text-xs text-rose-700">{error}</p>}

      {items && items.length > 0 && (
        <ul className="space-y-2 p-3">
          {items.map((it) => {
            const t = TONE[it.severity]
            const expanded = openKey === it.key
            return (
              <li key={it.key} className={`rounded-xl border ${t.row}`}>
                <button onClick={() => setOpenKey(expanded ? null : it.key)} className="flex w-full items-center gap-2 px-3 py-2.5 text-left">
                  <span className={`h-2 w-2 shrink-0 rounded-full ${t.dot}`} />
                  <span className="min-w-0 flex-1">
                    <span className="block text-[13px] font-semibold text-slate-900">
                      {it.title}
                      {it.amount ? <span className="font-normal text-slate-500"> · {rs(it.amount)}</span> : null}
                    </span>
                    <span className="block text-[11px] text-slate-500">{it.hint}</span>
                  </span>
                  <span className="shrink-0 rounded-lg bg-white px-2 py-0.5 text-sm font-black text-slate-900 shadow-sm">{it.count}</span>
                  <ChevronDown className={`h-4 w-4 shrink-0 text-slate-400 transition ${expanded ? 'rotate-180' : ''}`} />
                </button>
                {expanded && (
                  <div className="border-t border-white/60 px-3 pb-3">
                    <ul className="mt-2 space-y-1">
                      {(it.orders || []).map((o, i) => (
                        <li key={i} className="flex items-center gap-2 text-xs">
                          {o.orderNo != null && <span className="font-mono font-bold text-slate-500">#{o.orderNo}</span>}
                          <span className="truncate font-semibold text-slate-800">{o.customer}</span>
                          <span className="truncate text-slate-500">{o.detail}</span>
                          {o.amount > 0 && <span className="ml-auto shrink-0 font-mono text-slate-700">{rs(o.amount)}</span>}
                        </li>
                      ))}
                      {it.count > (it.orders?.length || 0) && (
                        <li className="text-[11px] text-slate-400">+ {it.count - (it.orders?.length || 0)} more</li>
                      )}
                    </ul>
                    <button
                      onClick={() => onOpen(it.open)}
                      className="mt-2 flex items-center gap-1 rounded-lg bg-slate-900 px-3 py-1.5 text-[11px] font-bold text-white hover:bg-slate-700"
                    >
                      {it.open.section === 'orders' ? `Open these ${it.count} order${it.count > 1 ? 's' : ''}` : 'Open'} <ArrowRight className="h-3.5 w-3.5" />
                    </button>
                  </div>
                )}
              </li>
            )
          })}
        </ul>
      )}
      {items && items.length > 0 && (
        <p className="flex items-center gap-1 px-4 pb-3 text-[10px] text-slate-400">
          <Info className="h-3 w-3" /> Red = urgent, orange = soon, blue = to do. The same list goes in the morning WhatsApp report.
        </p>
      )}
    </section>
  )
}
