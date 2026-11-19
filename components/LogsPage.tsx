'use client'

import React, { useCallback, useEffect, useRef, useState } from 'react'
import { Search, History, Loader2 } from 'lucide-react'
import { OrderHistoryDialog, SOURCE_STYLE, type OrderLogLine } from './OrderHistory'

// Logs page: one line per order (order no · customer · amount · last thing that happened).
// Clicking a line opens that order's full history.

interface Row {
  orderNo: number | null
  saleId: string | null
  customer: string | null
  phone: string | null
  total: number | null
  status: string
  paymentStatus: string | null
  events: number
  last: { action: string; message: string; source: OrderLogLine['source']; actor: string | null; at: string }
}

const STATUS_TONE: Record<string, string> = {
  PACKING: 'bg-amber-50 text-amber-700 border-amber-200',
  DISPATCHED: 'bg-blue-50 text-blue-700 border-blue-200',
  DELIVERED: 'bg-emerald-50 text-emerald-700 border-emerald-200',
  RETURNED: 'bg-rose-50 text-rose-700 border-rose-200',
  CANCELLED: 'bg-slate-100 text-slate-600 border-slate-200',
  DELETED: 'bg-slate-800 text-white border-slate-800',
}
const STATUS_WORD: Record<string, string> = {
  PACKING: 'Packing',
  DISPATCHED: 'Dispatched',
  DELIVERED: 'Delivered',
  RETURNED: 'Returned',
  CANCELLED: 'Cancelled',
  DELETED: 'Deleted',
}

const when = (iso: string) => {
  const d = new Date(iso)
  const mins = Math.round((Date.now() - d.getTime()) / 60000)
  if (mins < 1) return 'just now'
  if (mins < 60) return `${mins}m ago`
  if (mins < 24 * 60) return `${Math.round(mins / 60)}h ago`
  return d.toLocaleString('en-GB', { day: 'numeric', month: 'short', hour: '2-digit', minute: '2-digit' })
}
const rs = (n: number) => `Rs. ${Math.round(n).toLocaleString('en-PK')}`

const SOURCE_FILTERS: { value: string; label: string }[] = [
  { value: '', label: 'Everyone' },
  { value: 'USER', label: 'Team (by hand)' },
  { value: 'LEOPARDS', label: 'Leopards' },
  { value: 'WHATSAPP', label: 'WhatsApp' },
  { value: 'CUSTOMER', label: 'Customer' },
  { value: 'SYSTEM', label: 'System' },
]

export default function LogsPage() {
  const [rows, setRows] = useState<Row[]>([])
  const [search, setSearch] = useState('')
  const [source, setSource] = useState('')
  const [page, setPage] = useState(0)
  const [hasMore, setHasMore] = useState(false)
  const [loading, setLoading] = useState(true)
  const [error, setError] = useState('')
  const [open, setOpen] = useState<Row | null>(null)
  const reqId = useRef(0)

  const load = useCallback(
    async (pageNo: number) => {
      const id = ++reqId.current
      setLoading(true)
      setError('')
      try {
        const qs = new URLSearchParams({ page: String(pageNo) })
        if (search.trim()) qs.set('search', search.trim())
        if (source) qs.set('source', source)
        const res = await fetch(`/api/orders/logs/recent?${qs}`)
        const d = await res.json()
        if (!res.ok) throw new Error(d.error || 'Could not load the logs')
        if (id !== reqId.current) return // a newer search already started
        setRows((prev) => (pageNo === 0 ? d.rows : [...prev, ...d.rows]))
        setHasMore(d.hasMore)
        setPage(pageNo)
      } catch (e: any) {
        if (id === reqId.current) setError(e.message)
      } finally {
        if (id === reqId.current) setLoading(false)
      }
    },
    [search, source]
  )

  // Reload from the first page when the search / filter changes (search waits for typing to stop)
  useEffect(() => {
    const t = setTimeout(() => load(0), search ? 350 : 0)
    return () => clearTimeout(t)
  }, [load, search])

  return (
    <div className="bg-white border border-slate-200 rounded-2xl shadow-sm">
      <div className="p-3 sm:p-4 border-b border-slate-100 flex flex-col sm:flex-row sm:items-center gap-2">
        <div className="flex items-center gap-2">
          <History className="h-4 w-4 text-violet-600" />
          <div>
            <h2 className="text-sm font-bold text-slate-900">Order logs</h2>
            <p className="text-[11px] text-slate-500">Everything that happened to each order, by the team or automatically. Click an order to see its full history.</p>
          </div>
        </div>
        <div className="flex items-center gap-2 sm:ml-auto">
          <div className="relative flex-1 sm:w-64">
            <Search className="absolute left-3 top-2.5 h-4 w-4 text-slate-400" />
            <input
              value={search}
              onChange={(e) => setSearch(e.target.value)}
              placeholder="Search #, customer, phone, tracking…"
              className="w-full bg-slate-50 border border-slate-200 rounded-xl pl-9 pr-3 py-2 text-xs text-slate-800 focus:outline-none focus:border-violet-500 focus:bg-white"
            />
          </div>
          <select
            value={source}
            onChange={(e) => setSource(e.target.value)}
            className="bg-white border border-slate-200 rounded-xl px-2.5 py-2 text-xs text-slate-700 focus:outline-none focus:border-violet-500"
            title="Who did it"
          >
            {SOURCE_FILTERS.map((f) => (
              <option key={f.value} value={f.value}>
                {f.label}
              </option>
            ))}
          </select>
        </div>
      </div>

      {error && <p className="m-4 rounded-lg border border-rose-200 bg-rose-50 p-3 text-sm text-rose-700">{error}</p>}

      {/* Desktop table */}
      <div className="hidden md:block overflow-x-auto">
        <table className="w-full min-w-[860px] table-fixed text-left text-xs text-slate-700">
          <colgroup>
            <col className="w-[84px]" />
            <col className="w-[180px]" />
            <col className="w-[100px]" />
            <col className="w-[104px]" />
            <col />
            <col className="w-[70px]" />
          </colgroup>
          <thead>
            <tr className="bg-slate-50 text-[10px] text-slate-500 uppercase tracking-wider font-semibold border-b border-slate-200">
              <th className="px-3 py-2.5">Order</th>
              <th className="px-2 py-2.5">Customer</th>
              <th className="px-2 py-2.5">Amount</th>
              <th className="px-2 py-2.5">Status</th>
              <th className="px-2 py-2.5">Last activity</th>
              <th className="px-3 py-2.5 text-right">Events</th>
            </tr>
          </thead>
          <tbody>
            {rows.map((r, i) => {
              const s = SOURCE_STYLE[r.last.source] || SOURCE_STYLE.SYSTEM
              const Icon = s.icon
              return (
                <tr
                  key={`${r.orderNo ?? r.saleId}`}
                  onClick={() => setOpen(r)}
                  className={`cursor-pointer border-b border-slate-200 last:border-b-0 transition-colors hover:bg-violet-50 ${i % 2 ? 'bg-slate-100/80' : 'bg-white'}`}
                >
                  <td className="px-3 py-2.5 font-mono font-bold text-slate-700">{r.orderNo != null ? `#${r.orderNo}` : '—'}</td>
                  <td className="px-2 py-2.5 min-w-0">
                    <div className="font-semibold text-slate-900 truncate">{r.customer || <span className="text-slate-400">deleted order</span>}</div>
                    {r.phone && <div className="text-[11px] text-slate-400 truncate">{r.phone}</div>}
                  </td>
                  <td className="px-2 py-2.5 font-mono font-semibold text-slate-900">{r.total != null ? rs(r.total) : '—'}</td>
                  <td className="px-2 py-2.5">
                    <span className={`inline-flex rounded-full border px-2 py-0.5 text-[10px] font-semibold ${STATUS_TONE[r.status] || STATUS_TONE.CANCELLED}`}>
                      {STATUS_WORD[r.status] || r.status}
                    </span>
                  </td>
                  <td className="px-2 py-2.5 min-w-0">
                    <div className="flex items-start gap-2 min-w-0">
                      <span className={`mt-0.5 flex h-5 w-5 shrink-0 items-center justify-center rounded-full border ${s.tone}`}>
                        <Icon className="h-3 w-3" />
                      </span>
                      <div className="min-w-0">
                        <div className="truncate text-slate-800" title={r.last.message}>
                          {r.last.message}
                        </div>
                        <div className="text-[11px] text-slate-400">
                          {when(r.last.at)} · <span className="font-semibold text-slate-500">{r.last.actor || s.label}</span>
                        </div>
                      </div>
                    </div>
                  </td>
                  <td className="px-3 py-2.5 text-right">
                    <span className="rounded-md bg-violet-100 px-1.5 py-0.5 text-[11px] font-bold text-violet-700">{r.events}</span>
                  </td>
                </tr>
              )
            })}
          </tbody>
        </table>
      </div>

      {/* Phones: cards */}
      <div className="md:hidden divide-y divide-slate-100">
        {rows.map((r) => {
          const s = SOURCE_STYLE[r.last.source] || SOURCE_STYLE.SYSTEM
          return (
            <button key={`${r.orderNo ?? r.saleId}`} onClick={() => setOpen(r)} className="w-full text-left p-3 hover:bg-violet-50">
              <div className="flex items-center gap-2">
                <span className="font-mono font-bold text-slate-700">{r.orderNo != null ? `#${r.orderNo}` : '—'}</span>
                <span className="truncate font-semibold text-slate-900">{r.customer || 'deleted order'}</span>
                <span className="ml-auto font-mono text-sm font-semibold">{r.total != null ? rs(r.total) : ''}</span>
              </div>
              <div className="mt-1 flex items-center gap-2">
                <span className={`rounded-full border px-2 py-0.5 text-[10px] font-semibold ${STATUS_TONE[r.status] || STATUS_TONE.CANCELLED}`}>
                  {STATUS_WORD[r.status] || r.status}
                </span>
                <span className="text-[11px] text-slate-400">{r.events} events</span>
              </div>
              <div className="mt-1 text-[12px] text-slate-700 line-clamp-2">{r.last.message}</div>
              <div className="text-[11px] text-slate-400">
                {when(r.last.at)} · {r.last.actor || s.label}
              </div>
            </button>
          )
        })}
      </div>

      {!loading && !error && rows.length === 0 && <p className="py-12 text-center text-sm text-slate-500">No logs found.</p>}
      {loading && (
        <div className="flex items-center justify-center gap-2 py-6 text-sm text-slate-500">
          <Loader2 className="h-4 w-4 animate-spin" /> Loading…
        </div>
      )}
      {!loading && hasMore && (
        <div className="p-3 text-center">
          <button onClick={() => load(page + 1)} className="rounded-xl border border-slate-200 px-4 py-2 text-xs font-semibold text-slate-600 hover:border-violet-300 hover:text-violet-700">
            Load more
          </button>
        </div>
      )}

      {open && (
        <OrderHistoryDialog
          orderNo={open.orderNo}
          saleId={open.saleId}
          title={[open.customer, open.total != null ? rs(open.total) : null, STATUS_WORD[open.status]].filter(Boolean).join(' · ')}
          onClose={() => setOpen(null)}
        />
      )}
    </div>
  )
}
