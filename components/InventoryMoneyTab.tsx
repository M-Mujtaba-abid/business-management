'use client'

import React, { useEffect, useState } from 'react'
import { Boxes, ArrowRight, Loader2 } from 'lucide-react'

// Payments page → Inventory money: stock on hand, what was bought and who paid (in hand / savings),
// what sold from inventory with sales and profit, per item.

type Period = 'week' | 'month' | 'last-month' | 'all'
const toISO = (d: Date) => `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, '0')}-${String(d.getDate()).padStart(2, '0')}`
const periodRange = (p: Period) => {
  const now = new Date()
  if (p === 'week') {
    const s = new Date(now)
    s.setDate(now.getDate() - ((now.getDay() + 6) % 7))
    return { from: toISO(s), to: toISO(now) }
  }
  if (p === 'month') return { from: toISO(new Date(now.getFullYear(), now.getMonth(), 1)), to: toISO(now) }
  if (p === 'last-month') return { from: toISO(new Date(now.getFullYear(), now.getMonth() - 1, 1)), to: toISO(new Date(now.getFullYear(), now.getMonth(), 0)) }
  return { from: '', to: '' }
}
const rs = (n: number) => `Rs. ${Math.round(n).toLocaleString('en-PK')}`

interface Group {
  orders: number
  units: number
  sales: number
  cost: number
  grossProfit: number
}
interface Summary {
  onHand: { units: number; value: number; items: number; lowStock: number; outOfStock: number }
  bought: { purchases: number; units: number; total: number; byPerson: { id: string; name: string; fromHand: number; fromSavings: number }[] }
  invested: { id: string; name: string; amount: number }[]
  sold: {
    delivered: Group & { netProfit: number }
    inProgress: Group
    returned: Group & { itemsBack: number; itemsLost: number; loss: number }
  }
  items: {
    id: string
    name: string
    stockQty: number
    avgCost: number
    value: number
    lowStock: boolean
    boughtUnits: number
    boughtTotal: number
    soldUnits: number
    openUnits: number
    sales: number
    profit: number
  }[]
}

export default function InventoryMoneyTab({ onOpenInventory }: { onOpenInventory?: () => void }) {
  const [period, setPeriod] = useState<Period>('month')
  const [data, setData] = useState<Summary | null>(null)
  const [error, setError] = useState('')

  useEffect(() => {
    const { from, to } = periodRange(period)
    const qs = new URLSearchParams()
    if (from) qs.set('from', from)
    if (to) qs.set('to', to)
    setData(null)
    setError('')
    fetch(`/api/inventory/summary?${qs}`)
      .then(async (r) => {
        const d = await r.json()
        if (!r.ok) throw new Error(d.error || 'Could not load inventory money')
        setData(d)
      })
      .catch((e) => setError(e.message))
  }, [period])

  const label = period === 'week' ? 'This week' : period === 'month' ? 'This month' : period === 'last-month' ? 'Last month' : 'All time'

  return (
    <section className="bg-white border border-slate-200 rounded-2xl shadow-sm p-4 sm:p-5 space-y-4">
      <div className="flex flex-col sm:flex-row sm:items-center gap-2">
        <div>
          <h2 className="text-base font-bold text-slate-900 flex items-center gap-2">
            <Boxes className="h-5 w-5 text-teal-600" /> Inventory money
          </h2>
          <p className="text-xs text-slate-500">Stock bought (and who paid), what sold from inventory, sales and profit</p>
        </div>
        <div className="flex flex-wrap gap-1.5 sm:ml-auto">
          {(
            [
              ['week', 'This week'],
              ['month', 'This month'],
              ['last-month', 'Last month'],
              ['all', 'All time'],
            ] as [Period, string][]
          ).map(([v, l]) => (
            <button
              key={v}
              onClick={() => setPeriod(v)}
              className={`px-3 py-1.5 rounded-lg text-xs font-semibold transition ${period === v ? 'bg-teal-600 text-white' : 'bg-slate-100 text-slate-600 hover:bg-slate-200'}`}
            >
              {l}
            </button>
          ))}
        </div>
      </div>

      {error && <p className="rounded-lg border border-rose-200 bg-rose-50 p-3 text-sm text-rose-700">{error}</p>}
      {!data && !error && (
        <div className="flex justify-center py-8 text-slate-400">
          <Loader2 className="h-5 w-5 animate-spin" />
        </div>
      )}

      {data && (
        <>
          {/* Headline numbers */}
          <div className="grid grid-cols-2 lg:grid-cols-4 gap-3">
            <div className="rounded-xl border border-slate-200 p-3">
              <div className="text-[11px] text-slate-500">Stock on hand now</div>
              <div className="font-mono text-lg font-black text-slate-900">{rs(data.onHand.value)}</div>
              <div className="text-[11px] text-slate-500">
                {data.onHand.units} units · {data.onHand.items} items
                {data.onHand.outOfStock ? ` · ${data.onHand.outOfStock} out` : ''}
              </div>
            </div>
            <div className="rounded-xl border border-slate-200 p-3">
              <div className="text-[11px] text-slate-500">Stock bought · {label}</div>
              <div className="font-mono text-lg font-black text-rose-600">{rs(data.bought.total)}</div>
              <div className="text-[11px] text-slate-500">
                {data.bought.units} units · {data.bought.purchases} purchase{data.bought.purchases === 1 ? '' : 's'}
              </div>
            </div>
            <div className="rounded-xl border border-slate-200 p-3">
              <div className="text-[11px] text-slate-500">Sold from inventory · {label}</div>
              <div className="font-mono text-lg font-black text-slate-900">{rs(data.sold.delivered.sales)}</div>
              <div className="text-[11px] text-slate-500">
                {data.sold.delivered.units} units · {data.sold.delivered.orders} delivered order{data.sold.delivered.orders === 1 ? '' : 's'}
              </div>
            </div>
            <div className="rounded-xl border border-emerald-200 bg-emerald-50/50 p-3">
              <div className="text-[11px] text-emerald-700">Profit on inventory · {label}</div>
              <div className="font-mono text-lg font-black text-emerald-700">{rs(data.sold.delivered.netProfit)}</div>
              <div className="text-[11px] text-emerald-700/80">
                sale − cost {rs(data.sold.delivered.grossProfit)}, after DC / petrol / fees
              </div>
            </div>
          </div>

          <div className="grid lg:grid-cols-2 gap-3">
            {/* Who paid for stock */}
            <div className="rounded-xl border border-slate-200 p-3 text-xs space-y-1.5">
              <div className="font-semibold text-slate-700">Who paid for stock · {label}</div>
              {data.bought.byPerson.length === 0 && <p className="text-slate-400">No stock bought in this period.</p>}
              {data.bought.byPerson.map((p) => (
                <div key={p.id} className="flex flex-wrap justify-between gap-2">
                  <span className="font-semibold text-slate-800">{p.name}</span>
                  <span className="text-slate-600">
                    from in hand <b className="font-mono text-rose-600">{rs(p.fromHand)}</b> · from savings{' '}
                    <b className="font-mono text-amber-600">{rs(p.fromSavings)}</b>
                  </span>
                </div>
              ))}
              {data.invested.length > 0 && (
                <div className="mt-2 border-t border-slate-100 pt-2 text-[11px] text-slate-500">
                  Invested from own savings (all time):{' '}
                  {data.invested.map((p) => (
                    <span key={p.id} className="mr-3">
                      {p.name} <b className="font-mono text-amber-700">{rs(p.amount)}</b>
                    </span>
                  ))}
                </div>
              )}
            </div>

            {/* Orders using stock */}
            <div className="rounded-xl border border-slate-200 p-3 text-xs space-y-1.5">
              <div className="font-semibold text-slate-700">Orders from inventory · {label}</div>
              <div className="flex justify-between">
                <span className="text-slate-600">Delivered ({data.sold.delivered.orders})</span>
                <span className="font-mono">
                  sales {rs(data.sold.delivered.sales)} · cost {rs(data.sold.delivered.cost)}
                </span>
              </div>
              <div className="flex justify-between">
                <span className="text-slate-600">On the way ({data.sold.inProgress.orders})</span>
                <span className="font-mono">
                  {data.sold.inProgress.units} units · {rs(data.sold.inProgress.sales)}
                </span>
              </div>
              <div className="flex justify-between">
                <span className="text-slate-600">Returned ({data.sold.returned.orders})</span>
                <span className="font-mono">
                  {data.sold.returned.itemsBack} back in stock · {data.sold.returned.itemsLost} not back · loss {rs(-data.sold.returned.loss)}
                </span>
              </div>
            </div>
          </div>

          {/* Per item */}
          {data.items.length > 0 && (
            <div className="overflow-x-auto rounded-xl border border-slate-200">
              <table className="w-full min-w-[720px] text-left text-xs">
                <thead>
                  <tr className="bg-slate-50 text-[10px] uppercase tracking-wider text-slate-500 border-b border-slate-200">
                    <th className="px-3 py-2">Item</th>
                    <th className="px-2 py-2">In stock</th>
                    <th className="px-2 py-2">Value</th>
                    <th className="px-2 py-2">Bought ({label})</th>
                    <th className="px-2 py-2">Sold</th>
                    <th className="px-2 py-2">Sales</th>
                    <th className="px-3 py-2 text-right">Profit</th>
                  </tr>
                </thead>
                <tbody>
                  {data.items.map((i, idx) => (
                    <tr key={i.id} className={`border-b border-slate-100 last:border-b-0 ${idx % 2 ? 'bg-slate-50' : ''}`}>
                      <td className="px-3 py-2 font-semibold text-slate-800">{i.name}</td>
                      <td className={`px-2 py-2 font-mono ${i.stockQty <= 0 ? 'text-rose-600' : i.lowStock ? 'text-amber-600' : ''}`}>{i.stockQty}</td>
                      <td className="px-2 py-2 font-mono">{rs(i.value)}</td>
                      <td className="px-2 py-2 font-mono">{i.boughtUnits ? `${i.boughtUnits} · ${rs(i.boughtTotal)}` : '—'}</td>
                      <td className="px-2 py-2 font-mono">
                        {i.soldUnits}
                        {i.openUnits ? <span className="text-slate-400"> (+{i.openUnits} on the way)</span> : ''}
                      </td>
                      <td className="px-2 py-2 font-mono">{rs(i.sales)}</td>
                      <td className={`px-3 py-2 text-right font-mono font-bold ${i.profit >= 0 ? 'text-emerald-600' : 'text-rose-600'}`}>{rs(i.profit)}</td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          )}

          {onOpenInventory && (
            <button onClick={onOpenInventory} className="flex items-center gap-1 text-xs font-semibold text-teal-700 hover:underline">
              Open Inventory <ArrowRight className="h-3.5 w-3.5" />
            </button>
          )}
        </>
      )}
    </section>
  )
}
