'use client'

import React, { useEffect, useRef, useState } from 'react'
import { ChevronDown, Check, X, Search, Boxes } from 'lucide-react'

// "From inventory" picker in the order form: search box on top, the stock list below.
// Each line shows the item, how many are left and its average buy price.

export interface InventoryOption {
  id: string
  name: string
  stockQty: number
  avgCost: number
  salePrice: number | null
  categoryId: string | null
  lowStockAt: number | null
}

const rs = (n: number) => `Rs. ${Math.round(n).toLocaleString('en-PK')}`

interface Props {
  items: InventoryOption[]
  value: string
  onChange: (id: string) => void
  // stock already used by other lines of this order (so the list shows what is really left)
  usedElsewhere?: Record<string, number>
  // the quantity this line held before editing (edit mode), counted as available again
  heldByThisLine?: { itemId: string; qty: number } | null
  autoOpen?: boolean
}

export default function InventoryPicker({ items, value, onChange, usedElsewhere = {}, heldByThisLine, autoOpen = false }: Props) {
  const [open, setOpen] = useState(autoOpen)
  const [query, setQuery] = useState('')
  const wrapperRef = useRef<HTMLDivElement>(null)

  useEffect(() => {
    const onDown = (e: MouseEvent) => {
      if (wrapperRef.current && !wrapperRef.current.contains(e.target as Node)) setOpen(false)
    }
    document.addEventListener('mousedown', onDown)
    return () => document.removeEventListener('mousedown', onDown)
  }, [])

  const left = (it: InventoryOption) =>
    it.stockQty - (usedElsewhere[it.id] || 0) + (heldByThisLine && heldByThisLine.itemId === it.id ? heldByThisLine.qty : 0)

  const q = query.trim().toLowerCase()
  const list = items
    .filter((it) => it.name.toLowerCase().includes(q))
    .sort((a, b) => Number(left(b) > 0) - Number(left(a) > 0) || a.name.localeCompare(b.name))
  const selected = items.find((i) => i.id === value)

  const pick = (it: InventoryOption) => {
    if (left(it) <= 0 && it.id !== value) return
    onChange(it.id)
    setQuery('')
    setOpen(false)
  }

  return (
    <div ref={wrapperRef} className="relative">
      <button
        type="button"
        onClick={() => setOpen((o) => !o)}
        className="w-full bg-white border border-slate-300 rounded-xl px-3 py-2 text-sm text-left flex items-center justify-between focus:outline-none focus:border-teal-500 transition"
      >
        <span className={`flex items-center gap-2 min-w-0 ${selected ? 'text-slate-800' : 'text-slate-500'}`}>
          <Boxes className="h-4 w-4 shrink-0 text-teal-600" />
          <span className="truncate">{selected ? `${selected.name} · ${left(selected)} left` : 'Pick an item from inventory…'}</span>
        </span>
        <span className="flex items-center gap-1 shrink-0">
          {selected && (
            <X
              className="h-3.5 w-3.5 text-slate-500 hover:text-rose-600"
              onClick={(e) => {
                e.stopPropagation()
                onChange('')
              }}
            />
          )}
          <ChevronDown className="h-4 w-4 text-slate-500" />
        </span>
      </button>

      {open && (
        <div className="absolute z-30 mt-1 w-full bg-white border border-slate-300 rounded-xl shadow-2xl overflow-hidden">
          {/* search on top */}
          <div className="p-2 border-b border-slate-200">
            <div className="relative">
              <Search className="absolute left-2.5 top-2 h-3.5 w-3.5 text-slate-400" />
              <input
                autoFocus
                type="text"
                value={query}
                onChange={(e) => setQuery(e.target.value)}
                onKeyDown={(e) => {
                  if (e.key === 'Enter') {
                    e.preventDefault()
                    const first = list.find((it) => left(it) > 0)
                    if (first) pick(first)
                  }
                  if (e.key === 'Escape') setOpen(false)
                }}
                placeholder="Search inventory…"
                className="w-full bg-white border border-slate-300 rounded-lg pl-8 pr-2.5 py-1.5 text-xs text-slate-800 focus:outline-none focus:border-teal-500"
              />
            </div>
          </div>

          {/* the stock list */}
          <div className="max-h-60 overflow-y-auto py-1">
            {list.map((it) => {
              const n = left(it)
              const out = n <= 0 && it.id !== value
              const low = !out && it.lowStockAt != null && n <= it.lowStockAt
              return (
                <button
                  key={it.id}
                  type="button"
                  disabled={out}
                  onClick={() => pick(it)}
                  className={`w-full px-3 py-2 text-left flex items-center gap-2 ${out ? 'opacity-50 cursor-not-allowed' : 'hover:bg-teal-50'}`}
                >
                  <span className="min-w-0 flex-1">
                    <span className="block text-xs font-semibold text-slate-800 truncate">{it.name}</span>
                    <span className="block text-[10px] text-slate-500">
                      cost {rs(it.avgCost)}
                      {it.salePrice != null ? ` · sells ${rs(it.salePrice)}` : ''}
                    </span>
                  </span>
                  <span
                    className={`shrink-0 rounded-md border px-1.5 py-0.5 text-[10px] font-bold ${
                      out
                        ? 'bg-rose-50 text-rose-600 border-rose-200'
                        : low
                        ? 'bg-amber-50 text-amber-700 border-amber-200'
                        : 'bg-teal-50 text-teal-700 border-teal-200'
                    }`}
                  >
                    {out ? 'Out of stock' : `${n} left`}
                  </span>
                  {it.id === value && <Check className="h-3.5 w-3.5 text-teal-600 shrink-0" />}
                </button>
              )
            })}
            {list.length === 0 && (
              <p className="px-3 py-3 text-xs text-slate-500">
                {items.length === 0 ? 'Inventory is empty. Add items on the Inventory page.' : 'No item matches your search.'}
              </p>
            )}
          </div>
        </div>
      )}
    </div>
  )
}
