'use client'

import React, { useState, useEffect, useCallback } from 'react'
import { Users, ArrowUpRight, Calendar } from 'lucide-react'

interface PersonSummary {
  id: string | null
  name: string
  receivedAmount: number
  receivedCount: number
  expectedAmount: number
  expectedCount: number
}

interface PeopleMoneyTabProps {
  onViewOrders: (receivedById: string) => void // person id, or 'none'
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

const formatPKR = (n: number) => `Rs. ${n.toLocaleString()}`

// How much order money each person has received, and how much is still coming to them
export default function PeopleMoneyTab({ onViewOrders }: PeopleMoneyTabProps) {
  const [period, setPeriod] = useState<Period>('month')
  const [customFrom, setCustomFrom] = useState('')
  const [customTo, setCustomTo] = useState('')
  const [summary, setSummary] = useState<PersonSummary[]>([])
  const [isLoading, setIsLoading] = useState(true)

  const { from, to } = period === 'custom' ? { from: customFrom, to: customTo } : periodRange(period)

  const fetchSummary = useCallback(() => {
    setIsLoading(true)
    const params = new URLSearchParams()
    if (from) params.set('from', from)
    if (to) params.set('to', to)
    fetch(`/api/people/summary?${params.toString()}`)
      .then((r) => r.json())
      .then((data) => {
        if (Array.isArray(data)) setSummary(data)
      })
      .catch(console.error)
      .finally(() => setIsLoading(false))
  }, [from, to])

  useEffect(() => {
    fetchSummary()
  }, [fetchSummary])

  const totalReceived = summary.reduce((acc, p) => acc + p.receivedAmount, 0)
  const totalExpected = summary.reduce((acc, p) => acc + p.expectedAmount, 0)

  const periodLabel =
    period === 'week' ? 'this week' : period === 'month' ? 'this month' : period === 'last-month' ? 'last month' : period === 'all' ? 'all time' : 'in selected dates'

  return (
    <div className="bg-white border border-slate-200 rounded-2xl p-5 shadow-sm space-y-4">
      <div className="flex flex-wrap items-start justify-between gap-3">
        <div>
          <h2 className="text-base font-bold text-slate-900 flex items-center gap-2">
            <Users className="h-5 w-5 text-violet-600" /> Money with each person
          </h2>
          <p className="text-xs text-slate-500">Order payments received into each person&apos;s account</p>
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
              className={`px-2.5 py-1 rounded-lg text-xs font-semibold transition ${
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
        <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-3">
          {[...Array(2)].map((_, i) => (
            <div key={i} className="h-36 bg-slate-100/40 rounded-xl animate-pulse" />
          ))}
        </div>
      ) : (
        <>
          <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-3">
            {summary.map((p) => {
              const key = p.id || 'none'
              return (
                <div key={key} className="rounded-xl p-4 space-y-3 border border-violet-100 bg-violet-50/40">
                  <h3 className="font-bold text-slate-900">{p.name}</h3>

                  <div>
                    <div className="text-[11px] text-slate-500">Received {periodLabel}</div>
                    <div className="text-xl font-black font-mono text-violet-700">{formatPKR(p.receivedAmount)}</div>
                    <div className="text-[11px] text-slate-500">{p.receivedCount} order(s)</div>
                  </div>

                  <div className="text-xs text-slate-600 border-t border-violet-100 pt-2">
                    Still to come: <b className="font-mono">{formatPKR(p.expectedAmount)}</b>{' '}
                    <span className="text-slate-400">({p.expectedCount} delivered, not received)</span>
                  </div>

                  <button
                    onClick={() => onViewOrders(key)}
                    className="w-full px-2 py-1.5 rounded-lg bg-white border border-slate-200 hover:bg-slate-50 text-slate-700 text-[11px] font-semibold flex items-center justify-center gap-1"
                  >
                    View orders <ArrowUpRight className="h-3 w-3" />
                  </button>
                </div>
              )
            })}
          </div>

          <div className="flex flex-wrap gap-x-6 gap-y-1 text-xs text-slate-600 border-t border-slate-100 pt-3">
            <span>
              Total received {periodLabel}: <b className="font-mono text-slate-900">{formatPKR(totalReceived)}</b>
            </span>
            <span>
              Total still to come: <b className="font-mono text-slate-900">{formatPKR(totalExpected)}</b>
            </span>
          </div>
        </>
      )}
    </div>
  )
}
