'use client'

import React, { useState, useEffect, useCallback } from 'react'
import { Users, ArrowUpRight, Calendar, ArrowDownToLine, X, Trash2, History, ChevronDown, Truck, ScrollText, Landmark } from 'lucide-react'
import PersonStatement from './PersonStatement'
import BankCheckDialog, { BankCheckBadge, BankCheckRow } from './BankCheck'
import AddMoneyDialog from './AddMoney'
import { toast } from 'sonner'
import { formatDateTime } from '@/lib/format'

interface PersonSummary {
  id: string | null
  name: string
  receivedAmount: number
  receivedCount: number
  expensesAmount: number
  expensesCount: number
  withdrawnAmount: number
  withdrawnCount: number
  dcAmount: number
  dcCount: number
  stockAmount?: number // inventory stock bought from in hand (period)
  stockCount?: number
  investedAmount?: number // put in from personal savings (all time)
  lastBankCheck?: BankCheckRow | null // latest bank check (reconciliation)
  inHand: number
  expectedAmount: number
  expectedCount: number
}

interface Withdrawal {
  id: string
  personId: string
  amount: number
  reason: string | null
  type?: 'PROFIT' | 'CAPITAL'
  createdAt: string
}

// One order's delivery charge paid from a person's account
interface DcEntry {
  orderNo: number | null
  externalOrderId: string | null
  trackingNumber: string | null
  customerName: string
  dc: number
  status: string
  createdAt: string
}

interface PeopleMoneyTabProps {
  onViewOrders: (receivedById: string) => void // person id, or 'none'
  onChanged?: () => void
}

type Period = 'week' | 'month' | 'last-month' | 'all' | 'custom'

const toISO = (d: Date) =>
  `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, '0')}-${String(d.getDate()).padStart(2, '0')}`

// Date range for the period buttons (week starts Monday)
const periodRange = (period: Period): { from: string; to: string } => {
  const now = new Date()
  if (period === 'week') {
    const start = new Date(now)
    start.setDate(now.getDate() - ((now.getDay() + 6) % 7))
    return { from: toISO(start), to: toISO(now) }
  }
  if (period === 'month') {
    return { from: toISO(new Date(now.getFullYear(), now.getMonth(), 1)), to: toISO(now) }
  }
  if (period === 'last-month') {
    return {
      from: toISO(new Date(now.getFullYear(), now.getMonth() - 1, 1)),
      to: toISO(new Date(now.getFullYear(), now.getMonth(), 0)),
    }
  }
  return { from: '', to: '' }
}

const formatPKR = (n: number) => `Rs. ${Math.round(n).toLocaleString()}`

// How much business money each person holds: received order money minus expenses they paid and withdrawals
export default function PeopleMoneyTab({ onViewOrders, onChanged }: PeopleMoneyTabProps) {
  const [period, setPeriod] = useState<Period>('month')
  const [customFrom, setCustomFrom] = useState('')
  const [customTo, setCustomTo] = useState('')
  const [summary, setSummary] = useState<PersonSummary[]>([])
  const [withdrawals, setWithdrawals] = useState<Withdrawal[]>([])
  const [isLoading, setIsLoading] = useState(true)

  // Withdraw form (one person at a time)
  const [withdrawFor, setWithdrawFor] = useState<string | null>(null)
  const [wAmount, setWAmount] = useState('')
  const [wReason, setWReason] = useState('')
  const [wType, setWType] = useState<'PROFIT' | 'CAPITAL'>('PROFIT')
  const [addMoneyFor, setAddMoneyFor] = useState<{ id: string; name: string } | null>(null)
  const [isSaving, setIsSaving] = useState(false)
  const [historyFor, setHistoryFor] = useState<string | null>(null)
  const [statementFor, setStatementFor] = useState<{ id: string; name: string } | null>(null)
  const [bankCheckFor, setBankCheckFor] = useState<{ id: string; name: string } | null>(null)
  const [dcLogFor, setDcLogFor] = useState<string | null>(null)
  const [dcLog, setDcLog] = useState<DcEntry[]>([])
  const [dcLogLoading, setDcLogLoading] = useState(false)

  const { from, to } = period === 'custom' ? { from: customFrom, to: customTo } : periodRange(period)

  // DC log of the open person, for the selected period
  useEffect(() => {
    if (!dcLogFor) return
    setDcLogLoading(true)
    const params = new URLSearchParams({ personId: dcLogFor })
    if (from) params.set('from', from)
    if (to) params.set('to', to)
    fetch(`/api/people/dc-log?${params.toString()}`)
      .then((r) => r.json())
      .then((data) => setDcLog(Array.isArray(data) ? data : []))
      .catch(console.error)
      .finally(() => setDcLogLoading(false))
  }, [dcLogFor, from, to])

  const fetchAll = useCallback(() => {
    setIsLoading(true)
    const params = new URLSearchParams()
    if (from) params.set('from', from)
    if (to) params.set('to', to)
    Promise.all([
      fetch(`/api/people/summary?${params.toString()}`).then((r) => r.json()),
      fetch(`/api/withdrawals?${params.toString()}`).then((r) => r.json()),
    ])
      .then(([sum, wds]) => {
        if (Array.isArray(sum)) setSummary(sum)
        if (Array.isArray(wds)) setWithdrawals(wds)
      })
      .catch(console.error)
      .finally(() => setIsLoading(false))
  }, [from, to])

  useEffect(() => {
    fetchAll()
  }, [fetchAll])

  const openWithdraw = (personId: string) => {
    setWithdrawFor(personId)
    setWAmount('')
    setWReason('')
    setWType('PROFIT')
  }

  const saveWithdrawal = async (e: React.FormEvent) => {
    e.preventDefault()
    if (!withdrawFor) return
    const amt = parseFloat(wAmount)
    if (isNaN(amt) || amt <= 0) {
      toast.error('Enter a valid amount')
      return
    }
    // Quick check here; the server checks again before saving
    const person = summary.find((s) => s.id === withdrawFor)
    if (person && amt > person.inHand + 0.5) {
      toast.error(`${person.name} has only ${formatPKR(Math.max(0, person.inHand))} in hand. Cannot withdraw more than that.`)
      return
    }
    setIsSaving(true)
    try {
      const res = await fetch('/api/withdrawals', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ personId: withdrawFor, amount: amt, reason: wReason, type: wType }),
      })
      if (!res.ok) throw new Error((await res.json()).error || 'Failed to save withdrawal')
      toast.success('Withdrawal saved')
      setWithdrawFor(null)
      fetchAll()
      onChanged?.()
    } catch (err: any) {
      toast.error(err.message || 'Failed to save withdrawal')
    } finally {
      setIsSaving(false)
    }
  }

  const deleteWithdrawal = async (w: Withdrawal) => {
    if (!confirm(`Delete withdrawal of ${formatPKR(w.amount)}${w.reason ? ` (${w.reason})` : ''}?`)) return
    const res = await fetch(`/api/withdrawals/${w.id}`, { method: 'DELETE' })
    if (res.ok) {
      toast.success('Withdrawal deleted')
      fetchAll()
    } else {
      toast.error('Failed to delete withdrawal')
    }
  }

  const totalInHand = summary.reduce((acc, p) => acc + p.inHand, 0)
  const totalExpected = summary.reduce((acc, p) => acc + p.expectedAmount, 0)

  const periodLabel =
    period === 'week' ? 'This week' : period === 'month' ? 'This month' : period === 'last-month' ? 'Last month' : period === 'all' ? 'All time' : 'Selected dates'

  return (
    <div className="bg-white border border-slate-200 rounded-2xl p-4 sm:p-5 shadow-sm space-y-4">
      <div className="flex flex-wrap items-start justify-between gap-3">
        <div>
          <h2 className="text-base font-bold text-slate-900 flex items-center gap-2">
            <Users className="h-5 w-5 text-violet-600" /> Money with each person
          </h2>
          <p className="text-xs text-slate-500">
            Order money received (sale − cover cost), minus DC, expenses paid and withdrawals
          </p>
        </div>

        {/* Period picker */}
        <div className="flex flex-wrap items-center gap-1.5">
          {([
            ['week', 'This week'],
            ['month', 'This month'],
            ['last-month', 'Last month'],
            ['all', 'All time'],
            ['custom', 'Dates'],
          ] as [Period, string][]).map(([value, label]) => (
            <button
              key={value}
              onClick={() => setPeriod(value)}
              className={`px-2.5 py-1.5 rounded-lg text-xs font-semibold transition ${
                period === value ? 'bg-violet-600 text-white' : 'bg-slate-100 text-slate-600 hover:bg-slate-200'
              }`}
            >
              {label}
            </button>
          ))}
        </div>
      </div>

      {period === 'custom' && (
        <div className="flex flex-wrap items-center gap-2 text-xs">
          <Calendar className="h-4 w-4 text-slate-400" />
          <span className="text-slate-500">From</span>
          <input
            type="date"
            value={customFrom}
            onChange={(e) => setCustomFrom(e.target.value)}
            className="bg-white border border-slate-300 rounded-lg px-2 py-1 text-slate-800 focus:outline-none focus:border-violet-500"
          />
          <span className="text-slate-500">To</span>
          <input
            type="date"
            value={customTo}
            onChange={(e) => setCustomTo(e.target.value)}
            className="bg-white border border-slate-300 rounded-lg px-2 py-1 text-slate-800 focus:outline-none focus:border-violet-500"
          />
        </div>
      )}

      {isLoading ? (
        <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
          {[...Array(2)].map((_, i) => (
            <div key={i} className="h-56 bg-slate-100/40 rounded-xl animate-pulse" />
          ))}
        </div>
      ) : (
        <>
          <div className="grid grid-cols-1 sm:grid-cols-2 xl:grid-cols-3 gap-3">
            {summary.map((p) => {
              const key = p.id || 'none'
              const myWithdrawals = withdrawals.filter((w) => w.personId === p.id)
              return (
                <div key={key} className="rounded-xl p-4 space-y-3 border border-violet-100 bg-violet-50/40">
                  <div className="flex items-start justify-between gap-2">
                    <h3 className="font-bold text-slate-900">{p.name}</h3>
                    <div className="text-right">
                      <div className="text-[11px] text-slate-500">In hand now</div>
                      <div className={`text-xl font-black font-mono ${p.inHand >= 0 ? 'text-violet-700' : 'text-rose-600'}`}>
                        {formatPKR(p.inHand)}
                      </div>
                    </div>
                  </div>

                  {/* Period breakdown */}
                  <div className="rounded-lg bg-white border border-violet-100 p-2.5 space-y-1 text-xs">
                    <div className="text-[11px] font-semibold text-slate-500 mb-1">{periodLabel}</div>
                    <div className="flex justify-between">
                      <span className="text-slate-600">Received ({p.receivedCount} orders)</span>
                      <span className="font-mono font-semibold text-emerald-600">+ {formatPKR(p.receivedAmount)}</span>
                    </div>
                    <div className="flex justify-between">
                      <span className="text-slate-600">Expenses paid ({p.expensesCount})</span>
                      <span className="font-mono font-semibold text-rose-600">− {formatPKR(p.expensesAmount)}</span>
                    </div>
                    <div className="flex justify-between">
                      <span className="text-slate-600">Withdrawn ({p.withdrawnCount})</span>
                      <span className="font-mono font-semibold text-rose-600">− {formatPKR(p.withdrawnAmount)}</span>
                    </div>
                    {p.id && (
                      <button
                        type="button"
                        onClick={() => setDcLogFor(dcLogFor === p.id ? null : p.id)}
                        className="w-full flex justify-between hover:bg-violet-50 rounded -mx-1 px-1"
                        title="Show DC log"
                      >
                        <span className="text-slate-600 flex items-center gap-1">
                          DC paid ({p.dcCount} orders)
                          <ChevronDown className={`h-3 w-3 transition ${dcLogFor === p.id ? 'rotate-180' : ''}`} />
                        </span>
                        <span className="font-mono font-semibold text-rose-600">− {formatPKR(p.dcAmount)}</span>
                      </button>
                    )}
                    {p.id && (p.stockCount ?? 0) > 0 && (
                      <div className="flex justify-between" title="Inventory stock bought from this person's money in hand">
                        <span className="text-slate-600">Stock bought ({p.stockCount})</span>
                        <span className="font-mono font-semibold text-rose-600">− {formatPKR(p.stockAmount ?? 0)}</span>
                      </div>
                    )}
                  </div>
                  {(p.investedAmount ?? 0) > 0 && (
                    <div className="text-[11px] text-amber-700" title="Money put into inventory from personal savings (all time); not part of In hand">
                      Invested from own savings (all time): <b className="font-mono">{formatPKR(p.investedAmount ?? 0)}</b>
                    </div>
                  )}

                  {/* DC log for the period */}
                  {p.id && dcLogFor === p.id && (
                    <div className="rounded-lg bg-white border border-slate-200 p-2.5 space-y-1.5">
                      <div className="text-[11px] font-semibold text-slate-500 flex items-center gap-1">
                        <Truck className="h-3.5 w-3.5" /> DC log · {periodLabel}
                      </div>
                      {dcLogLoading ? (
                        <p className="text-xs text-slate-400">Loading...</p>
                      ) : dcLog.length === 0 ? (
                        <p className="text-xs text-slate-400">No DC paid in this period.</p>
                      ) : (
                        <div className="max-h-60 overflow-y-auto space-y-1.5">
                          {dcLog.map((d, i) => (
                            <div key={`${d.orderNo}-${i}`} className="flex items-start justify-between gap-2 text-xs">
                              <div className="min-w-0">
                                <div className="font-semibold text-slate-800">
                                  {d.orderNo ? `#${d.orderNo}` : 'Order'}
                                  {d.status === 'RETURNED' && <span className="ml-1 text-[10px] font-semibold text-amber-600">Returned</span>}
                                </div>
                                <div className="text-[11px] text-slate-500 truncate">
                                  {formatDateTime(d.createdAt)}
                                  {d.externalOrderId || d.trackingNumber ? ` · ${d.externalOrderId || d.trackingNumber}` : ''}
                                </div>
                              </div>
                              <div className="font-mono font-semibold text-rose-600 whitespace-nowrap">− {formatPKR(d.dc)}</div>
                            </div>
                          ))}
                        </div>
                      )}
                    </div>
                  )}

                  <div className="text-xs text-slate-600">
                    Still to come: <b className="font-mono">{formatPKR(p.expectedAmount)}</b>{' '}
                    <span className="text-slate-400">({p.expectedCount} delivered, not received)</span>
                  </div>

                  {/* Withdraw form */}
                  {p.id && withdrawFor === p.id && (
                    <form onSubmit={saveWithdrawal} className="rounded-lg bg-white border border-rose-200 p-3 space-y-2">
                      <div className="flex items-center justify-between">
                        <span className="text-xs font-semibold text-rose-700">Withdraw from {p.name}</span>
                        <button type="button" onClick={() => setWithdrawFor(null)} className="text-slate-400 hover:text-slate-700">
                          <X className="h-4 w-4" />
                        </button>
                      </div>
                      <input
                        type="number"
                        min="0"
                        step="0.01"
                        autoFocus
                        value={wAmount}
                        onChange={(e) => setWAmount(e.target.value)}
                        placeholder="Amount (Rs)"
                        className="w-full bg-white border border-slate-300 rounded-lg px-3 py-2 text-sm text-slate-800 focus:outline-none focus:border-rose-500"
                      />
                      <div className="text-[11px] text-slate-500">
                        Max you can withdraw: <span className="font-mono font-semibold text-slate-700">{formatPKR(Math.max(0, p.inHand))}</span>
                      </div>
                      {/* Profit = business money for yourself · Capital = your own invested money back */}
                      <div className="grid grid-cols-2 gap-1 rounded-lg border border-slate-200 p-0.5">
                        {(
                          [
                            ['PROFIT', 'Profit withdrawal'],
                            ['CAPITAL', 'Capital taken back'],
                          ] as const
                        ).map(([v, l]) => (
                          <button
                            key={v}
                            type="button"
                            onClick={() => setWType(v)}
                            className={`rounded-md px-2 py-1.5 text-[11px] font-bold ${wType === v ? (v === 'PROFIT' ? 'bg-rose-500 text-white' : 'bg-amber-500 text-white') : 'text-slate-500'}`}
                          >
                            {l}
                          </button>
                        ))}
                      </div>
                      <p className="text-[10px] text-slate-400">
                        {wType === 'PROFIT' ? 'Business money taken for yourself.' : 'Taking back your own money that you invested (lowers your capital too).'}
                      </p>
                      <input
                        type="text"
                        value={wReason}
                        onChange={(e) => setWReason(e.target.value)}
                        placeholder="Reason (e.g. personal use, profit share)"
                        className="w-full bg-white border border-slate-300 rounded-lg px-3 py-2 text-sm text-slate-800 focus:outline-none focus:border-rose-500"
                      />
                      <button
                        type="submit"
                        disabled={isSaving}
                        className="w-full py-2 rounded-lg bg-rose-500 hover:bg-rose-600 text-white text-xs font-bold disabled:opacity-50"
                      >
                        {isSaving ? 'Saving...' : 'Save withdrawal'}
                      </button>
                    </form>
                  )}

                  {/* Withdrawal history for the period */}
                  {p.id && historyFor === p.id && (
                    <div className="rounded-lg bg-white border border-slate-200 p-2.5 space-y-1.5">
                      <div className="text-[11px] font-semibold text-slate-500">Withdrawals · {periodLabel}</div>
                      {myWithdrawals.length === 0 ? (
                        <p className="text-xs text-slate-400">None in this period.</p>
                      ) : (
                        myWithdrawals.map((w) => (
                          <div key={w.id} className="flex items-center justify-between gap-2 text-xs">
                            <div className="min-w-0">
                              <div className="font-mono font-semibold text-slate-800">
                                {formatPKR(w.amount)}
                                {w.type === 'CAPITAL' && (
                                  <span className="ml-1.5 rounded bg-amber-100 px-1 py-px font-sans text-[10px] font-bold text-amber-800">capital back</span>
                                )}
                              </div>
                              <div className="text-[11px] text-slate-500 truncate">
                                {new Date(w.createdAt).toLocaleDateString()}
                                {w.reason ? ` · ${w.reason}` : ''}
                              </div>
                            </div>
                            <button onClick={() => deleteWithdrawal(w)} className="p-1 text-slate-400 hover:text-rose-600" title="Delete">
                              <Trash2 className="h-3.5 w-3.5" />
                            </button>
                          </div>
                        ))
                      )}
                    </div>
                  )}

                  <div className="grid grid-cols-3 gap-2">
                    {p.id ? (
                      <>
                        <button
                          onClick={() => (withdrawFor === p.id ? setWithdrawFor(null) : openWithdraw(p.id as string))}
                          className="px-2 py-2 rounded-lg bg-rose-500 hover:bg-rose-600 text-white text-[11px] font-bold flex items-center justify-center gap-1"
                        >
                          <ArrowDownToLine className="h-3.5 w-3.5" /> Withdraw
                        </button>
                        <button
                          onClick={() => setHistoryFor(historyFor === p.id ? null : (p.id as string))}
                          className="px-2 py-2 rounded-lg bg-white border border-slate-200 hover:bg-slate-50 text-slate-700 text-[11px] font-semibold flex items-center justify-center gap-1"
                        >
                          <History className="h-3.5 w-3.5" /> History
                        </button>
                      </>
                    ) : (
                      <div className="col-span-2" />
                    )}
                    <button
                      onClick={() => onViewOrders(key)}
                      className="px-2 py-2 rounded-lg bg-white border border-slate-200 hover:bg-slate-50 text-slate-700 text-[11px] font-semibold flex items-center justify-center gap-1"
                    >
                      Orders <ArrowUpRight className="h-3 w-3" />
                    </button>
                  </div>
                  {p.id && (
                    <>
                      <div className="grid grid-cols-2 gap-2">
                        <button
                          onClick={() => setStatementFor({ id: p.id as string, name: p.name })}
                          className="px-2 py-2 rounded-lg bg-violet-600 hover:bg-violet-700 text-white text-[11px] font-bold flex items-center justify-center gap-1"
                          title="Every amount added to or taken from this person's money, with the running balance"
                        >
                          <ScrollText className="h-3.5 w-3.5" /> In hand statement
                        </button>
                        <button
                          onClick={() => setBankCheckFor({ id: p.id as string, name: p.name })}
                          className="px-2 py-2 rounded-lg bg-white border border-violet-300 hover:bg-violet-50 text-violet-700 text-[11px] font-bold flex items-center justify-center gap-1"
                          title="Compare the real bank balance with In hand"
                        >
                          <Landmark className="h-3.5 w-3.5" /> Check bank
                        </button>
                      </div>
                      <button
                        onClick={() => setAddMoneyFor({ id: p.id as string, name: p.name })}
                        className="w-full px-2 py-1.5 rounded-lg border border-dashed border-violet-300 text-violet-700 hover:bg-violet-50 text-[11px] font-semibold flex items-center justify-center gap-1"
                        title="Opening balance, investment (own money in) or an adjustment"
                      >
                        + Add money (opening balance / investment / adjustment)
                      </button>
                      <BankCheckBadge check={p.lastBankCheck} />
                    </>
                  )}
                </div>
              )
            })}
          </div>

          <div className="flex flex-wrap gap-x-6 gap-y-1 text-xs text-slate-600 border-t border-slate-100 pt-3">
            <span>
              Total in hand: <b className="font-mono text-slate-900">{formatPKR(totalInHand)}</b>
            </span>
            <span>
              Total still to come: <b className="font-mono text-slate-900">{formatPKR(totalExpected)}</b>
            </span>
          </div>
        </>
      )}
      {statementFor && (
        <PersonStatement personId={statementFor.id} name={statementFor.name} initialFrom={from} initialTo={to} onClose={() => setStatementFor(null)} />
      )}
      {bankCheckFor && (
        <BankCheckDialog personId={bankCheckFor.id} name={bankCheckFor.name} onClose={() => setBankCheckFor(null)} onSaved={fetchAll} />
      )}
      {addMoneyFor && (
        <AddMoneyDialog
          personId={addMoneyFor.id}
          name={addMoneyFor.name}
          onClose={() => setAddMoneyFor(null)}
          onSaved={() => {
            setAddMoneyFor(null)
            fetchAll()
            onChanged?.()
          }}
        />
      )}
    </div>
  )
}
