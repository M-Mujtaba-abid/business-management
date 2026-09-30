'use client'

import React, { memo, useState } from 'react'
import { formatPKR, formatShort } from './hooks'

export interface WaterfallStep {
  label: string
  value: number // positive amount; for 'down' steps the amount taken away
  kind: 'total' | 'down'
  color: string
}

interface WaterfallChartProps {
  steps: WaterfallStep[]
  base: number // for "% of sales" in the tooltip
}

// Running-total bar chart: totals rise from zero, deductions hang from the previous level
function WaterfallChart({ steps, base }: WaterfallChartProps) {
  const [hovered, setHovered] = useState<number | null>(null)

  // Work out each bar's start / end level
  let level = 0
  const bars = steps.map((s) => {
    const from = s.kind === 'total' ? 0 : level
    const to = s.kind === 'total' ? s.value : level - s.value
    level = to
    return { ...s, from, to }
  })

  const levels = bars.flatMap((b) => [b.from, b.to])
  const max = Math.max(...levels, 1)
  const min = Math.min(...levels, 0)
  const span = max - min || 1
  const pct = (v: number) => ((v - min) / span) * 100

  return (
    <div className="flex flex-col h-full">
      <div className="relative flex-1 min-h-[200px] flex items-stretch gap-1.5 sm:gap-3 pt-6">
        {/* zero line */}
        <div className="absolute left-0 right-0 border-t border-slate-200" style={{ bottom: `${pct(0)}%` }} />

        {bars.map((b, i) => {
          const bottom = pct(Math.min(b.from, b.to))
          const height = Math.max(0.8, pct(Math.max(b.from, b.to)) - bottom)
          const isDown = b.kind === 'down'
          const isHover = hovered === i
          const next = bars[i + 1]
          return (
            <div
              key={b.label}
              className="relative flex-1 h-full"
              onMouseEnter={() => setHovered(i)}
              onMouseLeave={() => setHovered(null)}
              onClick={() => setHovered(isHover ? null : i)}
            >
              {/* connector to the next bar */}
              {next && next.kind === 'down' && (
                <div
                  className="absolute left-1/2 border-t border-dashed border-slate-300"
                  style={{ bottom: `${pct(b.to)}%`, width: 'calc(100% + 0.75rem)' }}
                />
              )}

              <div
                className={`absolute left-[12%] right-[12%] rounded-md transition-[filter,opacity] ${isDown ? 'viz-bar-down' : 'viz-bar'}`}
                style={{
                  bottom: `${bottom}%`,
                  height: `${height}%`,
                  background: b.color,
                  opacity: hovered === null || isHover ? 1 : 0.45,
                  animationDelay: `${i * 90}ms`,
                }}
              />

              {/* direct value label */}
              <div
                className="absolute left-0 right-0 text-center text-[10px] sm:text-[11px] font-semibold text-slate-700 font-mono viz-card"
                style={{ bottom: `calc(${bottom + height}% + 4px)`, animationDelay: `${300 + i * 90}ms` }}
              >
                {isDown ? '−' : ''}
                {formatShort(b.value)}
              </div>

              {/* tooltip */}
              {isHover && (
                <div
                  className="absolute z-10 left-1/2 -translate-x-1/2 whitespace-nowrap rounded-lg bg-slate-900 text-white text-[11px] px-2.5 py-1.5 shadow-lg pointer-events-none"
                  style={{ bottom: `calc(${bottom + height}% + 22px)` }}
                >
                  <div className="font-semibold">{b.label}</div>
                  <div className="font-mono">
                    {isDown ? '− ' : ''}
                    {formatPKR(b.value)}
                    {base > 0 && <span className="text-slate-300"> · {((b.value / base) * 100).toFixed(1)}% of sales</span>}
                  </div>
                </div>
              )}
            </div>
          )
        })}
      </div>

      {/* x labels */}
      <div className="flex gap-1.5 sm:gap-3 mt-2 border-t border-slate-100 pt-2">
        {bars.map((b) => (
          <div key={b.label} className="flex-1 text-center text-[10px] sm:text-[11px] leading-tight text-slate-500">
            {b.label}
          </div>
        ))}
      </div>
    </div>
  )
}

export default memo(WaterfallChart)
