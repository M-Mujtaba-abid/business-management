'use client'

import React, { useEffect, useState } from 'react'
import { createPortal } from 'react-dom'
import { X, History, User, Truck, MessageCircle, UserRound, Cpu, ChevronDown, Loader2 } from 'lucide-react'

// Order history: everything that happened to one order (by hand or automatically), as a timeline.

export interface OrderLogLine {
  id: string
  action: string
  message: string
  source: 'USER' | 'LEOPARDS' | 'WHATSAPP' | 'CUSTOMER' | 'SYSTEM'
  actor: string | null
  details: Record<string, any> | null
  createdAt: string
}

export const SOURCE_STYLE: Record<OrderLogLine['source'], { icon: React.ElementType; tone: string; label: string }> = {
  USER: { icon: User, tone: 'bg-violet-100 text-violet-700 border-violet-200', label: 'Team' },
  LEOPARDS: { icon: Truck, tone: 'bg-amber-100 text-amber-800 border-amber-200', label: 'Leopards' },
  WHATSAPP: { icon: MessageCircle, tone: 'bg-emerald-100 text-emerald-700 border-emerald-200', label: 'WhatsApp' },
  CUSTOMER: { icon: UserRound, tone: 'bg-sky-100 text-sky-700 border-sky-200', label: 'Customer' },
  SYSTEM: { icon: Cpu, tone: 'bg-slate-100 text-slate-600 border-slate-200', label: 'System' },
}

const dayLabel = (d: Date) => d.toLocaleDateString('en-GB', { weekday: 'short', day: 'numeric', month: 'short', year: 'numeric' })
const timeLabel = (d: Date) => d.toLocaleTimeString('en-GB', { hour: '2-digit', minute: '2-digit' })

function LogDetails({ line }: { line: OrderLogLine }) {
  const [open, setOpen] = useState(false)
  const d = line.details || {}
  const changes = d.changes as Record<string, { from: unknown; to: unknown }> | undefined
  const items = d.items as { product: string; qty: number; price: number }[] | undefined
  const hasMore = (changes && Object.keys(changes).length > 0) || (items && items.length > 0)
  if (!hasMore) return null
  const show = (v: unknown) => (v === null || v === undefined || v === '' ? '—' : String(v))
  return (
    <div className="mt-1">
      <button onClick={() => setOpen((v) => !v)} className="inline-flex items-center gap-0.5 text-[11px] font-semibold text-slate-500 hover:text-slate-800">
        Details <ChevronDown className={`h-3 w-3 transition ${open ? 'rotate-180' : ''}`} />
      </button>
      {open && (
        <div className="mt-1 rounded-lg border border-slate-200 bg-slate-50 p-2 text-[11px] text-slate-600 space-y-0.5">
          {items?.map((it, i) => (
            <div key={i}>
              {it.product} ×{it.qty} · Rs. {Math.round(it.price).toLocaleString('en-PK')}
            </div>
          ))}
          {changes &&
            Object.entries(changes).map(([k, v]) => (
              <div key={k}>
                <span className="font-semibold text-slate-700">{k}:</span> <span className="line-through text-rose-500">{show(v.from)}</span> →{' '}
                <span className="text-emerald-700">{show(v.to)}</span>
              </div>
            ))}
        </div>
      )}
    </div>
  )
}

export function OrderHistoryDialog({
  orderNo,
  saleId,
  title,
  onClose,
}: {
  orderNo?: number | null
  saleId?: string | null
  title?: string
  onClose: () => void
}) {
  const [lines, setLines] = useState<OrderLogLine[] | null>(null)
  const [error, setError] = useState('')
  const [mounted, setMounted] = useState(false)
  const closeRef = React.useRef(onClose)
  closeRef.current = onClose

  // Load once per order (a parent re-render must not reload it)
  useEffect(() => {
    setMounted(true)
    const q = orderNo != null ? `orderNo=${orderNo}` : `saleId=${encodeURIComponent(saleId || '')}`
    fetch(`/api/orders/logs?${q}`)
      .then(async (r) => {
        const d = await r.json()
        if (!r.ok) throw new Error(d.error || 'Could not load the history')
        setLines(d)
      })
      .catch((e) => setError(e.message))
    const onKey = (e: KeyboardEvent) => e.key === 'Escape' && closeRef.current()
    window.addEventListener('keydown', onKey)
    return () => window.removeEventListener('keydown', onKey)
  }, [orderNo, saleId])

  if (!mounted) return null

  // Group by day, newest day first; inside a day oldest first (reads like a story)
  const days: { day: string; items: OrderLogLine[] }[] = []
  for (const l of lines || []) {
    const day = dayLabel(new Date(l.createdAt))
    const last = days[days.length - 1]
    if (last && last.day === day) last.items.push(l)
    else days.push({ day, items: [l] })
  }
  days.reverse()

  return createPortal(
    <div className="fixed inset-0 z-[100] flex items-end sm:items-center justify-center bg-slate-900/40 p-0 sm:p-4" onClick={onClose}>
      <div
        role="dialog"
        aria-label="Order history"
        onClick={(e) => e.stopPropagation()}
        className="flex w-full sm:max-w-xl max-h-[92vh] flex-col overflow-hidden rounded-t-2xl sm:rounded-2xl bg-white shadow-xl"
      >
        <div className="flex items-center gap-2 border-b border-slate-100 px-4 py-3">
          <History className="h-4 w-4 text-violet-600" />
          <div className="min-w-0">
            <h2 className="text-sm font-bold text-slate-900 truncate">
              History{orderNo != null ? ` · Order #${orderNo}` : ''}
            </h2>
            {title && <p className="text-[11px] text-slate-500 truncate">{title}</p>}
          </div>
          <span className="ml-auto text-[11px] text-slate-400">{lines ? `${lines.length} event${lines.length === 1 ? '' : 's'}` : ''}</span>
          <button onClick={onClose} className="rounded-lg p-1.5 text-slate-400 hover:bg-slate-100 hover:text-slate-700" aria-label="Close">
            <X className="h-4 w-4" />
          </button>
        </div>

        <div className="flex-1 overflow-y-auto px-4 py-3">
          {error && <p className="rounded-lg border border-rose-200 bg-rose-50 p-3 text-sm text-rose-700">{error}</p>}
          {!lines && !error && (
            <div className="flex items-center justify-center gap-2 py-10 text-sm text-slate-500">
              <Loader2 className="h-4 w-4 animate-spin" /> Loading history…
            </div>
          )}
          {lines && lines.length === 0 && <p className="py-10 text-center text-sm text-slate-500">Nothing recorded for this order yet.</p>}

          {days.map((d) => (
            <div key={d.day} className="mb-4">
              <div className="sticky top-0 z-10 -mx-4 mb-2 bg-white/95 px-4 py-1 text-[11px] font-bold uppercase tracking-wide text-slate-400 backdrop-blur">
                {d.day}
              </div>
              <ol className="relative ml-3 border-l border-slate-200">
                {d.items.map((l) => {
                  const s = SOURCE_STYLE[l.source] || SOURCE_STYLE.SYSTEM
                  const Icon = s.icon
                  return (
                    <li key={l.id} className="relative mb-3 ml-5">
                      <span className={`absolute -left-[31px] top-0.5 flex h-6 w-6 items-center justify-center rounded-full border ${s.tone}`}>
                        <Icon className="h-3 w-3" />
                      </span>
                      <div className="text-[13px] leading-snug text-slate-800">{l.message}</div>
                      <div className="mt-0.5 flex flex-wrap items-center gap-x-2 text-[11px] text-slate-400">
                        <span>{timeLabel(new Date(l.createdAt))}</span>
                        <span>·</span>
                        <span className="font-semibold text-slate-500">{l.actor || s.label}</span>
                        {l.details?.backfilled && <span className="rounded bg-slate-100 px-1 text-[10px] text-slate-500">from earlier records</span>}
                      </div>
                      <LogDetails line={l} />
                    </li>
                  )
                })}
              </ol>
            </div>
          ))}
        </div>
      </div>
    </div>,
    document.body
  )
}

// Small "History" button for an order (list row, order drawer)
export function OrderHistoryButton({
  orderNo,
  saleId,
  title,
  variant = 'icon',
}: {
  orderNo?: number | null
  saleId?: string | null
  title?: string
  variant?: 'icon' | 'full'
}) {
  const [open, setOpen] = useState(false)
  return (
    <>
      <button
        type="button"
        onClick={(e) => {
          e.stopPropagation()
          setOpen(true)
        }}
        title="Order history: everything that happened to this order"
        className={
          variant === 'icon'
            ? 'p-1.5 rounded-lg bg-violet-50 hover:bg-violet-100 border border-violet-200/60 text-violet-600 transition'
            : 'flex items-center justify-center gap-1.5 px-3 py-2 rounded-xl bg-violet-50 border border-violet-200 text-violet-700 text-[11px] font-semibold hover:bg-violet-100 transition'
        }
      >
        <History className={variant === 'icon' ? 'h-3.5 w-3.5' : 'h-3.5 w-3.5'} />
        {variant === 'full' && 'History'}
      </button>
      {open && <OrderHistoryDialog orderNo={orderNo} saleId={saleId} title={title} onClose={() => setOpen(false)} />}
    </>
  )
}
