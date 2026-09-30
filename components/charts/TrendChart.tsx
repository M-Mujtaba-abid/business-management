'use client'

import React, { memo, useMemo, useState } from 'react'
import { useElementWidth, formatPKR, formatShort } from './hooks'

export interface TrendSeries {
  key: string
  label: string
  color: string
  values: number[]
}

interface TrendChartProps {
  dates: string[] // ISO date per point
  series: TrendSeries[]
  granularity: 'day' | 'month'
  height?: number
}

const PAD = { top: 10, right: 8, bottom: 22, left: 36 }

// Nice round axis ticks covering [min, max]
const niceTicks = (min: number, max: number, count = 4) => {
  const span = max - min || 1
  const raw = span / count
  const mag = Math.pow(10, Math.floor(Math.log10(raw)))
  const step = [1, 2, 2.5, 5, 10].map((m) => m * mag).find((s) => s >= raw) || raw
  const start = Math.floor(min / step) * step
  const ticks: number[] = []
  for (let v = start; v <= max + step * 0.5; v += step) ticks.push(Math.round(v * 100) / 100)
  return ticks
}

// Multi-series line chart on one money axis, with a crosshair tooltip
function TrendChart({ dates, series, granularity, height = 180 }: TrendChartProps) {
  const [wrapRef, width] = useElementWidth<HTMLDivElement>()
  const [hover, setHover] = useState<number | null>(null)
  const n = dates.length

  const geo = useMemo(() => {
    const all = series.flatMap((s) => s.values)
    const ticks = niceTicks(Math.min(0, ...all), Math.max(1, ...all))
    const yMin = ticks[0]
    const yMax = ticks[ticks.length - 1]
    const innerW = Math.max(1, width - PAD.left - PAD.right)
    const innerH = height - PAD.top - PAD.bottom
    const x = (i: number) => PAD.left + (n > 1 ? (i / (n - 1)) * innerW : innerW / 2)
    const y = (v: number) => PAD.top + innerH - ((v - yMin) / (yMax - yMin || 1)) * innerH
    const paths = series.map((s) =>
      s.values.map((v, i) => `${i ? 'L' : 'M'}${x(i).toFixed(1)},${y(v).toFixed(1)}`).join(' ')
    )
    return { ticks, x, y, innerW, paths }
  }, [series, width, height, n])

  const fmtDate = (iso: string, long = false) => {
    const d = new Date(iso)
    return granularity === 'month'
      ? d.toLocaleDateString('en-GB', { month: 'short', year: long ? 'numeric' : '2-digit' })
      : d.toLocaleDateString('en-GB', { day: 'numeric', month: 'short' })
  }

  const xLabels = n > 1 ? [0, Math.floor((n - 1) / 2), n - 1] : [0]

  const handleMove = (clientX: number, rect: DOMRect) => {
    if (n < 1) return
    const rel = clientX - rect.left - PAD.left
    const i = Math.round((rel / geo.innerW) * (n - 1))
    setHover(Math.max(0, Math.min(n - 1, i)))
  }

  return (
    <div className="space-y-2">
      {/* legend */}
      <div className="flex flex-wrap gap-x-3 gap-y-1 text-[11px] text-slate-600">
        {series.map((s) => (
          <span key={s.key} className="flex items-center gap-1.5">
            <span className="h-0.5 w-3 rounded-full" style={{ background: s.color }} />
            {s.label}
          </span>
        ))}
      </div>

      <div ref={wrapRef} className="relative w-full" style={{ height }}>
        {width > 0 && (
          <svg
            width={width}
            height={height}
            className="block touch-pan-y"
            onMouseMove={(e) => handleMove(e.clientX, e.currentTarget.getBoundingClientRect())}
            onMouseLeave={() => setHover(null)}
            onTouchStart={(e) => handleMove(e.touches[0].clientX, e.currentTarget.getBoundingClientRect())}
            onTouchMove={(e) => handleMove(e.touches[0].clientX, e.currentTarget.getBoundingClientRect())}
            role="img"
            aria-label={`Trend of ${series.map((s) => s.label).join(', ')}`}
          >
            {/* grid + y axis */}
            {geo.ticks.map((t) => (
              <g key={t}>
                <line x1={PAD.left} x2={width - PAD.right} y1={geo.y(t)} y2={geo.y(t)} stroke={t === 0 ? '#cbd5e1' : '#f1f5f9'} />
                <text x={PAD.left - 6} y={geo.y(t) + 3} textAnchor="end" fontSize="10" fill="#94a3b8">
                  {formatShort(t)}
                </text>
              </g>
            ))}

            {/* x labels */}
            {xLabels.map((i) => (
              <text
                key={i}
                x={geo.x(i)}
                y={height - 6}
                textAnchor={i === 0 ? 'start' : i === n - 1 ? 'end' : 'middle'}
                fontSize="10"
                fill="#94a3b8"
              >
                {fmtDate(dates[i])}
              </text>
            ))}

            {/* lines */}
            {geo.paths.map((d, si) => (
              <path
                key={series[si].key}
                d={d}
                fill="none"
                stroke={series[si].color}
                strokeWidth={2}
                strokeLinejoin="round"
                strokeLinecap="round"
                pathLength={1}
                className="viz-line"
                style={{ animationDelay: `${si * 150}ms` }}
              />
            ))}

            {/* crosshair */}
            {hover !== null && (
              <g pointerEvents="none">
                <line x1={geo.x(hover)} x2={geo.x(hover)} y1={PAD.top} y2={height - PAD.bottom} stroke="#94a3b8" strokeDasharray="3 3" />
                {series.map((s) => (
                  <circle key={s.key} cx={geo.x(hover)} cy={geo.y(s.values[hover])} r={4} fill={s.color} stroke="#fff" strokeWidth={2} />
                ))}
              </g>
            )}
          </svg>
        )}

        {/* tooltip */}
        {hover !== null && width > 0 && (
          <div
            className="absolute top-0 z-10 rounded-lg bg-slate-900 text-white text-[11px] px-2.5 py-1.5 shadow-lg pointer-events-none whitespace-nowrap"
            style={{
              left: Math.min(Math.max(geo.x(hover) - 70, 0), Math.max(0, width - 150)),
            }}
          >
            <div className="font-semibold mb-0.5">{fmtDate(dates[hover], true)}</div>
            {series.map((s) => (
              <div key={s.key} className="flex items-center justify-between gap-3">
                <span className="flex items-center gap-1.5">
                  <span className="h-2 w-2 rounded-full" style={{ background: s.color }} />
                  {s.label}
                </span>
                <span className="font-mono">{formatPKR(s.values[hover])}</span>
              </div>
            ))}
          </div>
        )}
      </div>
    </div>
  )
}

export default memo(TrendChart)
