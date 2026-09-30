'use client'

import React, { memo } from 'react'

interface MiniBarsProps {
  values: number[]
  color: string
  bars?: number
  className?: string
}

// Small bar strip for a stat card; shows the last `bars` buckets, decorative
function MiniBars({ values, color, bars = 8, className = 'h-10 w-20' }: MiniBarsProps) {
  const recent = values.slice(-bars)
  if (recent.length === 0) return null
  const max = Math.max(...recent, 1)
  const gap = 2
  const barW = (100 - gap * (recent.length - 1)) / recent.length

  return (
    <svg viewBox="0 0 100 40" preserveAspectRatio="none" className={className} aria-hidden="true">
      {recent.map((v, i) => {
        const h = Math.max(2, (v / max) * 38)
        return (
          <rect
            key={i}
            x={i * (barW + gap)}
            y={40 - h}
            width={barW}
            height={h}
            rx={1.5}
            fill={color}
            opacity={v > 0 ? 0.85 : 0.2}
            className="viz-svg-bar"
            style={{ animationDelay: `${i * 45}ms` }}
          />
        )
      })}
    </svg>
  )
}

export default memo(MiniBars)
