'use client'

import React, { useEffect, useState } from 'react'
import { createPortal } from 'react-dom'
import { X, Loader2, Send } from 'lucide-react'
import { toast } from 'sonner'

// Send money from one person to another (a real bank transfer, e.g. Noman Meezan → Mujtaba Mashreq).
// One entry: − in the sender's statement, + in the receiver's.

const rs = (n: number) => `Rs. ${Math.round(n).toLocaleString('en-PK')}`
const today = () => {
  const d = new Date()
  return `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, '0')}-${String(d.getDate()).padStart(2, '0')}`
}

export default function SendMoneyDialog({
  from,
  people,
  inHand,
  initialAmount,
  initialToId,
  initialNote,
  onClose,
  onSaved,
}: {
  from: { id: string; name: string }
  people: { id: string; name: string }[]
  inHand: number
  initialAmount?: number
  initialToId?: string
  initialNote?: string
  onClose: () => void
  onSaved: () => void
}) {
  const others = people.filter((p) => p.id !== from.id)
  const [toId, setToId] = useState(initialToId || others[0]?.id || '')
  const [amount, setAmount] = useState(initialAmount != null ? String(Math.round(initialAmount * 100) / 100) : '')
  const [date, setDate] = useState(today())
  const [note, setNote] = useState(initialNote || '')
  const [busy, setBusy] = useState(false)
  const [mounted, setMounted] = useState(false)
  useEffect(() => setMounted(true), [])

  const to = others.find((p) => p.id === toId)
  const value = parseFloat(amount) || 0

  const save = async (e: React.FormEvent) => {
    e.preventDefault()
    setBusy(true)
    try {
      const res = await fetch('/api/transfers', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ fromId: from.id, toId, amount: value, date: new Date(`${date}T12:00:00`).toISOString(), note }),
      })
      const d = await res.json()
      if (!res.ok) throw new Error(d.error || 'Could not save')
      toast.success(`${from.name} → ${to?.name}: ${rs(value)} recorded`)
      onSaved()
    } catch (err: any) {
      toast.error(err.message)
    } finally {
      setBusy(false)
    }
  }

  if (!mounted) return null
  const field = 'w-full rounded-lg border border-slate-300 bg-white px-3 py-2 text-sm focus:outline-none focus:border-sky-500'
  return createPortal(
    <div className="fixed inset-0 z-[110] flex items-end sm:items-center justify-center bg-slate-900/40 sm:p-4" onClick={onClose}>
      <div onClick={(e) => e.stopPropagation()} className="w-full sm:max-w-md rounded-t-2xl sm:rounded-2xl bg-white shadow-xl">
        <div className="flex items-center gap-2 border-b border-slate-100 px-4 py-3">
          <Send className="h-4 w-4 text-sky-600" />
          <h2 className="text-sm font-bold text-slate-900">Send money · from {from.name}</h2>
          <button onClick={onClose} className="ml-auto rounded-lg p-1.5 text-slate-400 hover:bg-slate-100" aria-label="Close">
            <X className="h-4 w-4" />
          </button>
        </div>
        <form onSubmit={save} className="space-y-3 p-4">
          <p className="text-[11px] text-slate-500">
            Record a real bank transfer you made. {from.name} has <b className="font-mono">{rs(inHand)}</b> in hand.
          </p>
          <div>
            <label className="mb-1 block text-[11px] font-semibold text-slate-600">Sent to</label>
            <div className="flex flex-wrap gap-1.5">
              {others.map((p) => (
                <button
                  key={p.id}
                  type="button"
                  onClick={() => setToId(p.id)}
                  className={`rounded-lg border px-3 py-1.5 text-xs font-bold ${toId === p.id ? 'border-sky-400 bg-sky-50 text-sky-800' : 'border-slate-200 text-slate-500'}`}
                >
                  {p.name}
                </button>
              ))}
            </div>
          </div>
          <div className="grid grid-cols-2 gap-2">
            <div>
              <label className="mb-1 block text-[11px] font-semibold text-slate-600">Amount *</label>
              <input autoFocus type="number" min="0" step="0.01" value={amount} onChange={(e) => setAmount(e.target.value)} className={`${field} font-mono`} />
              <button type="button" onClick={() => setAmount(String(Math.max(0, Math.round(inHand * 100) / 100)))} className="mt-1 text-[10px] font-semibold text-sky-700 hover:underline">
                all ({rs(inHand)})
              </button>
            </div>
            <div>
              <label className="mb-1 block text-[11px] font-semibold text-slate-600">Date</label>
              <input type="date" value={date} onChange={(e) => setDate(e.target.value)} className={field} />
            </div>
          </div>
          <div>
            <label className="mb-1 block text-[11px] font-semibold text-slate-600">Note</label>
            <input value={note} onChange={(e) => setNote(e.target.value)} placeholder="e.g. Meezan → Mashreq, Leopards payments" className={field} />
          </div>
          {value > 0 && to && (
            <div className="rounded-lg bg-slate-50 px-3 py-2 text-xs text-slate-700">
              {from.name}: <b className="font-mono text-rose-600">− {rs(value)}</b> · {to.name}: <b className="font-mono text-emerald-600">+ {rs(value)}</b>
            </div>
          )}
          <div className="flex justify-end gap-2">
            <button type="button" onClick={onClose} className="rounded-lg border border-slate-200 px-3 py-2 text-xs font-semibold text-slate-600">
              Cancel
            </button>
            <button type="submit" disabled={busy || !(value > 0) || !toId} className="flex items-center gap-1 rounded-lg bg-sky-600 px-4 py-2 text-xs font-bold text-white disabled:opacity-50">
              {busy && <Loader2 className="h-4 w-4 animate-spin" />} Save
            </button>
          </div>
        </form>
      </div>
    </div>,
    document.body
  )
}
