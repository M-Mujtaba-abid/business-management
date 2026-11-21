'use client'

import React, { useEffect, useState } from 'react'
import { createPortal } from 'react-dom'
import { X, Loader2, Flag, PiggyBank, SlidersHorizontal } from 'lucide-react'
import { toast } from 'sonner'

// Add money to a person's In hand that is not an order: opening balance, investment (own money in),
// or an adjustment (with a reason). Also used by Bank check → "Fix this difference".

export type MoneyKind = 'OPENING' | 'INVESTMENT' | 'ADJUSTMENT'

const KINDS: { value: MoneyKind; label: string; icon: React.ElementType; help: string; tone: string }[] = [
  {
    value: 'OPENING',
    label: 'Opening balance',
    icon: Flag,
    help: 'Business money that was already in this account when you started using the app (first order). Once per person — saving it again replaces the old one.',
    tone: 'border-violet-300 bg-violet-50 text-violet-800',
  },
  {
    value: 'INVESTMENT',
    label: 'Investment',
    icon: PiggyBank,
    help: 'Own personal money put into the business account. In hand goes up, and it is added to this person’s capital.',
    tone: 'border-emerald-300 bg-emerald-50 text-emerald-800',
  },
  {
    value: 'ADJUSTMENT',
    label: 'Adjustment',
    icon: SlidersHorizontal,
    help: 'Last resort, for a small difference you cannot explain (bank profit, bank fee…). A reason is required; it shows in orange in the statement.',
    tone: 'border-amber-300 bg-amber-50 text-amber-800',
  },
]

const rs = (n: number) => `Rs. ${Math.round(n).toLocaleString('en-PK')}`
const today = () => {
  const d = new Date()
  return `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, '0')}-${String(d.getDate()).padStart(2, '0')}`
}

export default function AddMoneyDialog({
  personId,
  name,
  initialKind = 'INVESTMENT',
  initialAmount,
  initialNote,
  onClose,
  onSaved,
}: {
  personId: string
  name: string
  initialKind?: MoneyKind
  initialAmount?: number // + or − (an adjustment can take money away)
  initialNote?: string
  onClose: () => void
  onSaved: () => void
}) {
  const [kind, setKind] = useState<MoneyKind>(initialKind)
  const [amount, setAmount] = useState(initialAmount != null ? String(Math.abs(Math.round(initialAmount * 100) / 100)) : '')
  const [minus, setMinus] = useState((initialAmount ?? 0) < 0) // adjustment only
  const [date, setDate] = useState(today())
  const [openingDate, setOpeningDate] = useState('') // opening balance: the day you started (first real order)
  const [note, setNote] = useState(initialNote || '')
  const [info, setInfo] = useState<{ firstOrderDate: string | null; opening: { amount: number; date?: string } | null } | null>(null)
  const [busy, setBusy] = useState(false)
  const [mounted, setMounted] = useState(false)

  useEffect(() => {
    setMounted(true)
    fetch(`/api/people/${personId}/money-entries`)
      .then((r) => r.json())
      .then((d) => {
        if (d.error) return
        setInfo({ firstOrderDate: d.firstOrderDate, opening: d.opening })
        const from = d.opening?.date || d.firstOrderDate
        if (from) {
          const x = new Date(from)
          setOpeningDate(`${x.getFullYear()}-${String(x.getMonth() + 1).padStart(2, '0')}-${String(x.getDate()).padStart(2, '0')}`)
        }
      })
      .catch(() => {})
  }, [personId])

  const k = KINDS.find((x) => x.value === kind)!
  const value = (parseFloat(amount) || 0) * (kind === 'ADJUSTMENT' && minus ? -1 : 1)

  const save = async (e: React.FormEvent) => {
    e.preventDefault()
    if (kind === 'OPENING' && info?.opening && !confirm(`${name} already has an opening balance of ${rs(info.opening.amount)}. Replace it with ${rs(value)}?`)) return
    setBusy(true)
    try {
      const res = await fetch(`/api/people/${personId}/money-entries`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          kind,
          amount: value,
          // opening: start of that day, so it comes before that day's orders
          date:
            kind === 'OPENING'
              ? openingDate
                ? new Date(`${openingDate}T00:00:00`).toISOString()
                : null
              : new Date(`${date}T12:00:00`).toISOString(),
          note,
        }),
      })
      const d = await res.json()
      if (!res.ok) throw new Error(d.error || 'Could not save')
      toast.success(`${k.label} saved for ${name}: ${value < 0 ? '−' : '+'}${rs(Math.abs(value))}`)
      onSaved()
    } catch (err: any) {
      toast.error(err.message)
    } finally {
      setBusy(false)
    }
  }

  if (!mounted) return null
  const field = 'w-full rounded-lg border border-slate-300 bg-white px-3 py-2 text-sm focus:outline-none focus:border-violet-500'
  return createPortal(
    <div className="fixed inset-0 z-[110] flex items-end sm:items-center justify-center bg-slate-900/40 sm:p-4" onClick={onClose}>
      <div onClick={(e) => e.stopPropagation()} className="w-full sm:max-w-md max-h-[94vh] overflow-y-auto rounded-t-2xl sm:rounded-2xl bg-white shadow-xl">
        <div className="flex items-center gap-2 border-b border-slate-100 px-4 py-3">
          <h2 className="text-sm font-bold text-slate-900">Add money · {name}</h2>
          <button onClick={onClose} className="ml-auto rounded-lg p-1.5 text-slate-400 hover:bg-slate-100" aria-label="Close">
            <X className="h-4 w-4" />
          </button>
        </div>
        <form onSubmit={save} className="space-y-3 p-4">
          <div className="grid grid-cols-3 gap-1.5">
            {KINDS.map((x) => {
              const Icon = x.icon
              return (
                <button
                  key={x.value}
                  type="button"
                  onClick={() => setKind(x.value)}
                  className={`flex flex-col items-center gap-1 rounded-xl border px-2 py-2 text-[11px] font-bold ${kind === x.value ? x.tone : 'border-slate-200 text-slate-500'}`}
                >
                  <Icon className="h-4 w-4" /> {x.label}
                </button>
              )
            })}
          </div>
          <p className="text-[11px] text-slate-500">{k.help}</p>

          <div className="grid grid-cols-[1fr_auto] gap-2 items-end">
            <div>
              <label className="mb-1 block text-[11px] font-semibold text-slate-600">Amount *</label>
              <input autoFocus type="number" min="0" step="0.01" value={amount} onChange={(e) => setAmount(e.target.value)} className={`${field} font-mono`} />
            </div>
            {kind === 'ADJUSTMENT' && (
              <div className="flex rounded-lg border border-slate-200 p-0.5">
                {[false, true].map((m) => (
                  <button
                    key={String(m)}
                    type="button"
                    onClick={() => setMinus(m)}
                    className={`rounded-md px-3 py-1.5 text-xs font-bold ${minus === m ? (m ? 'bg-rose-600 text-white' : 'bg-emerald-600 text-white') : 'text-slate-500'}`}
                  >
                    {m ? '− Less' : '+ More'}
                  </button>
                ))}
              </div>
            )}
          </div>

          {kind === 'OPENING' ? (
            <div className="space-y-1">
              <label className="mb-1 block text-[11px] font-semibold text-slate-600">Start date (the day you started using the app)</label>
              <input type="date" value={openingDate} onChange={(e) => setOpeningDate(e.target.value)} className={field} />
              <p className="rounded-lg bg-violet-50 px-3 py-2 text-[11px] text-violet-800">
                Filled with your first real order
                {info?.firstOrderDate ? ` (${new Date(info.firstOrderDate).toLocaleDateString('en-GB', { day: 'numeric', month: 'short', year: 'numeric' })})` : ''}. It becomes the first
                line of the statement.
                {info?.opening ? ` Current opening balance: ${rs(info.opening.amount)} (will be replaced).` : ''}
              </p>
            </div>
          ) : (
            <div>
              <label className="mb-1 block text-[11px] font-semibold text-slate-600">Date</label>
              <input type="date" value={date} onChange={(e) => setDate(e.target.value)} className={field} />
            </div>
          )}

          <div>
            <label className="mb-1 block text-[11px] font-semibold text-slate-600">{kind === 'ADJUSTMENT' ? 'Reason *' : 'Note'}</label>
            <input
              value={note}
              onChange={(e) => setNote(e.target.value)}
              placeholder={kind === 'ADJUSTMENT' ? 'e.g. bank profit / bank fee' : kind === 'INVESTMENT' ? 'e.g. from savings, for new stock' : 'e.g. Mashreq balance before the app'}
              className={field}
            />
          </div>

          <div className="rounded-lg bg-slate-50 px-3 py-2 text-xs text-slate-700">
            {name}&apos;s In hand will go {value < 0 ? 'down' : 'up'} by <b className="font-mono">{rs(Math.abs(value))}</b>
            {kind === 'INVESTMENT' && value > 0 ? ' and their capital goes up by the same' : ''}.
          </div>

          <div className="flex justify-end gap-2">
            <button type="button" onClick={onClose} className="rounded-lg border border-slate-200 px-3 py-2 text-xs font-semibold text-slate-600">
              Cancel
            </button>
            <button
              type="submit"
              disabled={busy || !(parseFloat(amount) > 0) || (kind === 'ADJUSTMENT' && !note.trim())}
              className="flex items-center gap-1 rounded-lg bg-violet-600 px-4 py-2 text-xs font-bold text-white disabled:opacity-50"
            >
              {busy && <Loader2 className="h-4 w-4 animate-spin" />} Save
            </button>
          </div>
        </form>
      </div>
    </div>,
    document.body
  )
}
