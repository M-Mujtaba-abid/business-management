'use client'

import React, { useEffect, useState } from 'react'
import { createPortal } from 'react-dom'
import { X, Loader2, Landmark, CheckCircle2, AlertTriangle } from 'lucide-react'
import { toast } from 'sonner'
import AddMoneyDialog from './AddMoney'

// Bank check: type the real balance from the bank app; the app compares it with In hand.
// Business-only accounts and no cash, so the two should be equal. If not, the statement lines
// since the last matched check are listed to find what is missing.

export interface BankCheckRow {
  id: string
  bankName: string
  bankBalance: number
  inHand: number
  difference: number
  note: string | null
  createdBy: string | null
  createdAt: string
}
interface Entry {
  id: string
  date: string
  kind: string
  amount: number
  title: string
  detail: string
  balance: number
}
interface Data {
  inHand: number
  bankName: string
  checks: BankCheckRow[]
  lastMatchedAt: string | null
  entries: Entry[]
}

const rs = (n: number) => `Rs. ${Math.round(n).toLocaleString('en-PK')}`
const MATCH = 1
const when = (iso: string) => new Date(iso).toLocaleString('en-GB', { day: 'numeric', month: 'short', hour: '2-digit', minute: '2-digit' })

export function diffText(d: number) {
  if (Math.abs(d) < MATCH) return 'Matches ✓'
  return d > 0 ? `Bank has ${rs(d)} MORE than the app` : `Bank has ${rs(-d)} LESS than the app`
}

// Small status line for the person card
export function BankCheckBadge({ check }: { check: BankCheckRow | null | undefined }) {
  if (!check) return <span className="text-[11px] text-slate-400">Bank not checked yet</span>
  const ok = Math.abs(check.difference) < MATCH
  return (
    <span className={`inline-flex items-center gap-1 text-[11px] font-semibold ${ok ? 'text-emerald-700' : 'text-amber-700'}`} title={`${check.bankName} ${rs(check.bankBalance)} vs app ${rs(check.inHand)}`}>
      {ok ? <CheckCircle2 className="h-3.5 w-3.5" /> : <AlertTriangle className="h-3.5 w-3.5" />}
      {check.bankName} · {when(check.createdAt)} · {ok ? 'matched' : `off by ${rs(Math.abs(check.difference))}`}
    </span>
  )
}

export default function BankCheckDialog({ personId, name, onClose, onSaved }: { personId: string; name: string; onClose: () => void; onSaved?: () => void }) {
  const [data, setData] = useState<Data | null>(null)
  const [bankName, setBankName] = useState('')
  const [balance, setBalance] = useState('')
  const [note, setNote] = useState('')
  const [busy, setBusy] = useState(false)
  const [result, setResult] = useState<BankCheckRow | null>(null)
  const [fixing, setFixing] = useState(false)
  const [hasOpening, setHasOpening] = useState(false)
  const [mounted, setMounted] = useState(false)
  const closeRef = React.useRef(onClose)
  closeRef.current = onClose

  useEffect(() => {
    setMounted(true)
    fetch(`/api/people/${personId}/bank-checks`)
      .then((r) => r.json())
      .then((d) => {
        if (d.error) throw new Error(d.error)
        setData(d)
        setBankName(d.bankName || '')
      })
      .catch((e) => toast.error(e.message))
    fetch(`/api/people/${personId}/money-entries`)
      .then((r) => r.json())
      .then((d) => setHasOpening(Boolean(d?.opening)))
      .catch(() => {})
    const onKey = (e: KeyboardEvent) => e.key === 'Escape' && closeRef.current()
    window.addEventListener('keydown', onKey)
    return () => window.removeEventListener('keydown', onKey)
  }, [personId])

  const typed = parseFloat(balance)
  const preview = data && Number.isFinite(typed) ? Math.round((typed - data.inHand) * 100) / 100 : null

  const save = async (e: React.FormEvent) => {
    e.preventDefault()
    setBusy(true)
    try {
      const res = await fetch(`/api/people/${personId}/bank-checks`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ bankBalance: balance, bankName, note }),
      })
      const d = await res.json()
      if (!res.ok) throw new Error(d.error || 'Could not save')
      setData(d)
      setResult(d.check)
      setBalance('')
      setNote('')
      if (d.matched) toast.success(`${name}: bank matches the app ✓`)
      else toast.warning(`${name}: ${diffText(d.check.difference)}`)
      onSaved?.()
    } catch (err: any) {
      toast.error(err.message)
    } finally {
      setBusy(false)
    }
  }

  if (!mounted) return null
  return createPortal(
    <div className="fixed inset-0 z-[100] flex items-end sm:items-center justify-center bg-slate-900/40 sm:p-4" onClick={onClose}>
      <div onClick={(e) => e.stopPropagation()} className="flex w-full sm:max-w-2xl max-h-[94vh] flex-col overflow-hidden rounded-t-2xl sm:rounded-2xl bg-white shadow-xl">
        <div className="flex items-center gap-2 border-b border-slate-100 px-4 py-3">
          <Landmark className="h-4 w-4 text-violet-600" />
          <div>
            <h2 className="text-sm font-bold text-slate-900">{name} · Bank check</h2>
            <p className="text-[11px] text-slate-500">Business-only account: the bank balance should equal In hand in the app</p>
          </div>
          <button onClick={onClose} className="ml-auto rounded-lg p-1.5 text-slate-400 hover:bg-slate-100 hover:text-slate-700" aria-label="Close">
            <X className="h-4 w-4" />
          </button>
        </div>

        <div className="flex-1 overflow-y-auto p-4 space-y-4">
          {!data ? (
            <div className="flex justify-center py-10 text-slate-400">
              <Loader2 className="h-5 w-5 animate-spin" />
            </div>
          ) : (
            <>
              {/* Enter the bank balance */}
              <form onSubmit={save} className="rounded-xl border border-violet-200 bg-violet-50/40 p-3 space-y-3">
                <div className="grid sm:grid-cols-3 gap-2">
                  <div>
                    <label className="block text-[11px] font-semibold text-slate-600 mb-1">Bank</label>
                    <input
                      value={bankName}
                      onChange={(e) => setBankName(e.target.value)}
                      placeholder="Meezan / Mashreq"
                      className="w-full rounded-lg border border-slate-300 bg-white px-3 py-2 text-sm focus:outline-none focus:border-violet-500"
                    />
                  </div>
                  <div>
                    <label className="block text-[11px] font-semibold text-slate-600 mb-1">Balance in the bank app now *</label>
                    <input
                      autoFocus
                      type="number"
                      step="0.01"
                      value={balance}
                      onChange={(e) => setBalance(e.target.value)}
                      placeholder="e.g. 40862"
                      className="w-full rounded-lg border border-slate-300 bg-white px-3 py-2 text-sm font-mono focus:outline-none focus:border-violet-500"
                    />
                  </div>
                  <div>
                    <label className="block text-[11px] font-semibold text-slate-600 mb-1">In hand in the app</label>
                    <div className="px-3 py-2 text-sm font-mono font-bold text-slate-900">{rs(data.inHand)}</div>
                  </div>
                </div>
                {preview !== null && (
                  <div className={`rounded-lg px-3 py-2 text-sm font-semibold ${Math.abs(preview) < MATCH ? 'bg-emerald-100 text-emerald-800' : 'bg-amber-100 text-amber-800'}`}>
                    {diffText(preview)}
                  </div>
                )}
                <div className="flex gap-2">
                  <input
                    value={note}
                    onChange={(e) => setNote(e.target.value)}
                    placeholder="Note (optional)"
                    className="flex-1 rounded-lg border border-slate-300 bg-white px-3 py-2 text-sm focus:outline-none focus:border-violet-500"
                  />
                  <button type="submit" disabled={busy || !Number.isFinite(typed) || !bankName.trim()} className="rounded-lg bg-violet-600 px-4 py-2 text-xs font-bold text-white disabled:opacity-50">
                    {busy ? 'Saving…' : 'Save check'}
                  </button>
                </div>
              </form>

              {/* Result of the check just saved */}
              {result && (
                <div className={`rounded-xl border p-3 text-sm ${Math.abs(result.difference) < MATCH ? 'border-emerald-200 bg-emerald-50 text-emerald-800' : 'border-amber-200 bg-amber-50 text-amber-900'}`}>
                  <div className="font-bold">{diffText(result.difference)}</div>
                  <div className="text-xs">
                    {result.bankName} {rs(result.bankBalance)} − app {rs(result.inHand)} = {rs(result.difference)}
                  </div>
                  {Math.abs(result.difference) >= MATCH && (
                    <ul className="mt-2 list-disc pl-4 text-xs space-y-0.5">
                      {result.difference > 0 ? (
                        <>
                          <li>Money came into the bank that is not in the app: an order not marked Received, or marked for the other person?</li>
                          <li>A withdrawal / expense / DC entered in the app that did not really leave this account?</li>
                        </>
                      ) : (
                        <>
                          <li>Money left the bank that is not in the app: an expense, DC, withdrawal or stock payment not entered?</li>
                          <li>An order marked Received in the app whose money went to the other person&apos;s account?</li>
                          <li>Money sent to the other person (Meezan → Mashreq) but the order still shows this person?</li>
                        </>
                      )}
                      <li>Check the lines below against the bank app, one by one.</li>
                    </ul>
                  )}
                  {Math.abs(result.difference) >= MATCH && (
                    <button
                      onClick={() => setFixing(true)}
                      className="mt-2 rounded-lg bg-violet-600 px-3 py-1.5 text-xs font-bold text-white hover:bg-violet-700"
                    >
                      Fix this difference ({result.difference > 0 ? '+' : '−'}
                      {rs(Math.abs(result.difference))}) →
                    </button>
                  )}
                </div>
              )}
              {fixing && result && (
                <AddMoneyDialog
                  personId={personId}
                  name={name}
                  // bank has MORE: money in that the app does not know (opening balance first, else investment)
                  // bank has LESS: a negative adjustment (after checking for a missing withdrawal / expense)
                  initialKind={result.difference > 0 ? (hasOpening ? 'INVESTMENT' : 'OPENING') : 'ADJUSTMENT'}
                  initialAmount={result.difference}
                  initialNote={result.difference < 0 ? 'bank has less than the app' : ''}
                  onClose={() => setFixing(false)}
                  onSaved={() => {
                    setFixing(false)
                    setResult(null)
                    onSaved?.()
                    toast.info('Saved. Do the bank check again to confirm it matches ✓')
                  }}
                />
              )}

              {/* What changed since the last matched check */}
              <div>
                <div className="mb-1 text-xs font-bold text-slate-700">
                  {data.lastMatchedAt ? `Money in / out since the last matched check (${when(data.lastMatchedAt)})` : 'Latest money in / out (no matched check yet)'}
                </div>
                <div className="overflow-x-auto rounded-xl border border-slate-200">
                  <table className="w-full min-w-[520px] text-left text-xs">
                    <thead>
                      <tr className="bg-slate-50 text-[10px] uppercase tracking-wider text-slate-500 border-b border-slate-200">
                        <th className="px-3 py-2">Date</th>
                        <th className="px-2 py-2">What</th>
                        <th className="px-2 py-2 text-right">Amount</th>
                        <th className="px-3 py-2 text-right">Balance</th>
                      </tr>
                    </thead>
                    <tbody>
                      {data.entries.map((e, i) => (
                        <tr key={e.id} className={`border-b border-slate-100 ${i % 2 ? 'bg-slate-50/70' : ''}`}>
                          <td className="px-3 py-1.5 whitespace-nowrap text-slate-500">{when(e.date)}</td>
                          <td className="px-2 py-1.5">
                            <div className="font-semibold text-slate-800">{e.title}</div>
                            {e.detail && <div className="text-[11px] text-slate-500">{e.detail}</div>}
                          </td>
                          <td className={`px-2 py-1.5 text-right font-mono font-semibold whitespace-nowrap ${e.amount >= 0 ? 'text-emerald-600' : 'text-rose-600'}`}>
                            {e.amount >= 0 ? '+' : '−'} {rs(Math.abs(e.amount))}
                          </td>
                          <td className="px-3 py-1.5 text-right font-mono font-bold whitespace-nowrap">{rs(e.balance)}</td>
                        </tr>
                      ))}
                    </tbody>
                  </table>
                  {data.entries.length === 0 && <p className="py-4 text-center text-xs text-slate-500">No money in or out since the last matched check.</p>}
                </div>
              </div>

              {/* Past checks */}
              {data.checks.length > 0 && (
                <div>
                  <div className="mb-1 text-xs font-bold text-slate-700">Past checks</div>
                  <ul className="divide-y divide-slate-100 rounded-xl border border-slate-200">
                    {data.checks.map((c) => {
                      const ok = Math.abs(c.difference) < MATCH
                      return (
                        <li key={c.id} className="flex flex-wrap items-center gap-x-3 gap-y-0.5 px-3 py-2 text-xs">
                          {ok ? <CheckCircle2 className="h-3.5 w-3.5 text-emerald-600" /> : <AlertTriangle className="h-3.5 w-3.5 text-amber-600" />}
                          <span className="text-slate-500">{when(c.createdAt)}</span>
                          <span className="font-semibold text-slate-800">
                            {c.bankName} {rs(c.bankBalance)}
                          </span>
                          <span className="text-slate-500">app {rs(c.inHand)}</span>
                          <span className={`font-semibold ${ok ? 'text-emerald-700' : 'text-amber-700'}`}>{ok ? 'matched' : `off by ${rs(c.difference)}`}</span>
                          <span className="ml-auto text-slate-400">
                            {c.createdBy}
                            {c.note ? ` · ${c.note}` : ''}
                          </span>
                        </li>
                      )
                    })}
                  </ul>
                </div>
              )}
            </>
          )}
        </div>
      </div>
    </div>,
    document.body
  )
}
