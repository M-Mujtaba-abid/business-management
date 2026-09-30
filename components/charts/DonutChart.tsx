'use client'

import React, { memo, useMemo, useState } from 'react'
import { formatPKR } from './hooks'

export interface DonutItem {
  label: string
  amount: number
}

interface DonutChartProps {
  items: DonutItem[]
  colors: string[] // fixed categorical order, one per slot
  maxSlices?: number
}

// Share-of-total ring with a labelled legend (label + amount + %) so identity never relies on colour alone
function DonutChart({ items, colors, maxSlices = 6 }: DonutChartProps) {
  const [hovered, setHovered] = useState<number | null>(null)

  const slices = useMemo(() => {
    const sorted = [...items].filter((i) => i.amount > 0).sort((a, b) => b.amount - a.amount)
    // Fold the tail into "Other" so we never need more hues than the palette has
    const top = sorted.length > maxSlices ? sorted.slice(0, maxSlices - 1) : sorted
    const rest = sorted.length > maxSlices ? sorted.slice(maxSlices - 1) : []
    const list = rest.length ? [...top, { label: 'Other', amount: rest.reduce((a, r) => a + r.amount, 0) }] : top
    const total = list.reduce((a, s) => a + s.amount, 0) || 1
    let offset = 0
    return {
      total,
      list: list.map((s, i) => {
        const pct = (s.amount / total) * 100
        const slice = { ...s, pct, offset, color: colors[i % colors.length] }
        offset += pct
        return slice
      }),
    }
  }, [items, colors, maxSlices])

  if (slices.list.length === 0) {
    return <p className="text-sm text-slate-400 text-center py-10">No expenses in this period</p>
  }

  const active = hovered !== null ? slices.list[hovered] : null
  const gap = slices.list.length > 1 ? 0.8 : 0 // surface gap between slices

  return (
    <div className="flex flex-col sm:flex-row xl:flex-col items-center gap-4">
      <div className="relative h-36 w-36 shrink-0">
        <svg viewBox="0 0 42 42" className="h-full w-full -rotate-90" role="img" aria-label="Expense breakdown">
          <circle cx="21" cy="21" r="15.9155" fill="none" stroke="#f1f5f9" strokeWidth="6" />
          {slices.list.map((s, i) => (
            <circle
              key={s.label}
              cx="21"
              cy="21"
              r="15.9155"
              fill="none"
              stroke={s.color}
              strokeWidth={hovered === i ? 7 : 6}
              pathLength={100}
              strokeDasharray={`${Math.max(0.1, s.pct - gap)} ${100 - Math.max(0.1, s.pct - gap)}`}
              strokeDashoffset={-s.offset}
              opacity={hovered === null || hovered === i ? 1 : 0.35}
              className="viz-sweep cursor-pointer transition-[opacity,stroke-width]"
              style={{ animationDelay: `${i * 80}ms` }}
              onMouseEnter={() => setHovered(i)}
              onMouseLeave={() => setHovered(null)}
            />
          ))}
        </svg>
        <div className="absolute inset-0 flex flex-col items-center justify-center text-center pointer-events-none px-3">
          <span className="text-[10px] text-slate-500 truncate max-w-full">{active ? active.label : 'Total'}</span>
          <span className="text-sm font-bold text-slate-900 font-mono">{formatPKR(active ? active.amount : slices.total)}</span>
          {active && <span className="text-[10px] text-slate-500">{active.pct.toFixed(1)}%</span>}
        </div>
      </div>

      <ul className="w-full space-y-1">
        {slices.list.map((s, i) => (
          <li
            key={s.label}
            onMouseEnter={() => setHovered(i)}
            onMouseLeave={() => setHovered(null)}
            className={`flex items-center justify-between gap-2 text-xs rounded-md px-1.5 py-0.5 transition ${hovered === i ? 'bg-slate-100' : ''}`}
          >
            <span className="flex items-center gap-1.5 min-w-0">
              <span className="h-2.5 w-2.5 rounded-sm shrink-0" style={{ background: s.color }} />
              <span className="text-slate-700 truncate">{s.label}</span>
            </span>
            <span className="text-slate-500 font-mono shrink-0">
              {formatPKR(s.amount)} <span className="text-slate-400">· {s.pct.toFixed(0)}%</span>
            </span>
          </li>
        ))}
      </ul>
    </div>
  )
}

export default memo(DonutChart)
