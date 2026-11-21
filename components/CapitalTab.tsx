'use client'

import React, { useEffect, useState } from 'react'
import { PiggyBank, Loader2, ChevronDown } from 'lucide-react'

// Payments → Capital: each partner's own (personal) money in the business.
//   put in (cash)  = investments · put in (stock) = inventory bought from savings
//   taken back     = "Capital taken back" withdrawals · net = what is still in the business

interface Row {
  id: string
  name: string
  cashIn: number
  stockIn: number
  takenBack: number
  net: number
}
interface Line {
  id: string
  personId: string
  date: string
  kind: 'cash' | 'stock' | 'back'
  amount: number
  note: string
}

const rs = (n: number) => `Rs. ${Math.round(n).toLocaleString('en-PK')}`
const KIND: Record<Line['kind'], { label: string; tone: string }> = {
  cash: { label: 'Put in (cash)', tone: 'bg-emerald-100 text-emerald-800' },
  stock: { label: 'Put in (stock)', tone: 'bg-teal-100 text-teal-800' },
  back: { label: 'Taken back', tone: 'bg-amber-100 text-amber-800' },
}

export default function CapitalTab({ refreshKey }: { refreshKey?: number }) {
  const [data, setData] = useState<{ people: Row[]; lines: Line[] } | null>(null)
  const [error, setError] = useState('')
  const [openFor, setOpenFor] = useState<string | null>(null)

  useEffect(() => {
    setData(null)
    fetch('/api/capital')
      .then(async (r) => {
        const d = await r.json()
        if (!r.ok) throw new Error(d.error || 'Could not load capital')
        setData(d)
      })
      .catch((e) => setError(e.message))
  }, [refreshKey])

  const total = data?.people.reduce((a, p) => a + p.net, 0) || 0

  return (
    <section className="bg-white border border-slate-200 rounded-2xl shadow-sm p-4 sm:p-5 space-y-3">
      <div>
        <h2 className="text-base font-bold text-slate-900 flex items-center gap-2">
          <PiggyBank className="h-5 w-5 text-emerald-600" /> Capital (our own money in the business)
        </h2>
        <p className="text-xs text-slate-500">
          Investments (Payments → + Add money → Investment) and inventory bought from savings, minus “Capital taken back” withdrawals
        </p>
      </div>

      {error && <p className="rounded-lg border border-rose-200 bg-rose-50 p-3 text-sm text-rose-700">{error}</p>}
      {!data && !error && (
        <div className="flex justify-center py-6 text-slate-400">
          <Loader2 className="h-5 w-5 animate-spin" />
        </div>
      )}

      {data && (
        <>
          <div className="overflow-x-auto rounded-xl border border-slate-200">
            <table className="w-full min-w-[560px] text-left text-xs">
              <thead>
                <tr className="bg-slate-50 text-[10px] uppercase tracking-wider text-slate-500 border-b border-slate-200">
                  <th className="px-3 py-2">Partner</th>
                  <th className="px-2 py-2 text-right">Put in (cash)</th>
                  <th className="px-2 py-2 text-right">Put in (stock)</th>
                  <th className="px-2 py-2 text-right">Taken back</th>
                  <th className="px-3 py-2 text-right">Net capital</th>
                  <th className="w-8" />
                </tr>
              </thead>
              <tbody>
                {data.people.map((p, i) => {
                  const mine = data.lines.filter((l) => l.personId === p.id)
                  const open = openFor === p.id
                  return (
                    <React.Fragment key={p.id}>
                      <tr
                        onClick={() => setOpenFor(open ? null : p.id)}
                        className={`cursor-pointer border-b border-slate-100 hover:bg-emerald-50/50 ${i % 2 ? 'bg-slate-50/70' : ''}`}
                      >
                        <td className="px-3 py-2.5 font-semibold text-slate-900">{p.name}</td>
                        <td className="px-2 py-2.5 text-right font-mono">{rs(p.cashIn)}</td>
                        <td className="px-2 py-2.5 text-right font-mono">{rs(p.stockIn)}</td>
                        <td className="px-2 py-2.5 text-right font-mono text-amber-700">{p.takenBack ? `− ${rs(p.takenBack)}` : rs(0)}</td>
                        <td className="px-3 py-2.5 text-right font-mono font-black text-emerald-700">{rs(p.net)}</td>
                        <td className="px-2">
                          <ChevronDown className={`h-4 w-4 text-slate-400 transition ${open ? 'rotate-180' : ''}`} />
                        </td>
                      </tr>
                      {open && (
                        <tr>
                          <td colSpan={6} className="bg-slate-50 px-3 py-2">
                            {mine.length === 0 ? (
                              <p className="text-[11px] text-slate-400">No capital in or out yet.</p>
                            ) : (
                              <ul className="space-y-1">
                                {mine.map((l) => (
                                  <li key={l.id} className="flex items-center gap-2 text-[11px]">
                                    <span className="w-20 shrink-0 text-slate-500">
                                      {new Date(l.date).toLocaleDateString('en-GB', { day: 'numeric', month: 'short', year: '2-digit' })}
                                    </span>
                                    <span className={`shrink-0 rounded px-1.5 py-px font-bold ${KIND[l.kind].tone}`}>{KIND[l.kind].label}</span>
                                    <span className="truncate text-slate-600">{l.note}</span>
                                    <span className={`ml-auto shrink-0 font-mono font-semibold ${l.amount < 0 ? 'text-amber-700' : 'text-emerald-700'}`}>
                                      {l.amount < 0 ? '−' : '+'} {rs(Math.abs(l.amount))}
                                    </span>
                                  </li>
                                ))}
                              </ul>
                            )}
                          </td>
                        </tr>
                      )}
                    </React.Fragment>
                  )
                })}
              </tbody>
            </table>
          </div>
          <p className="text-xs text-slate-600">
            Total partners&apos; capital in the business: <b className="font-mono text-slate-900">{rs(total)}</b>
            <span className="text-slate-400"> · click a partner to see every line</span>
          </p>
        </>
      )}
    </section>
  )
}
