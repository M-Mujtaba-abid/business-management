'use client'

import React from 'react'

export function CardSkeleton({ count = 4 }: { count?: number }) {
  return (
    <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-5 gap-4">
      {[...Array(count)].map((_, i) => (
        <div key={i} className="h-28 bg-slate-900/60 border border-slate-800 rounded-xl animate-pulse p-4" />
      ))}
    </div>
  )
}

export function TableSkeleton({ rows = 5 }: { rows?: number }) {
  return (
    <div className="space-y-3">
      {[...Array(rows)].map((_, i) => (
        <div key={i} className="h-14 bg-slate-900/40 border border-slate-800/60 rounded-xl animate-pulse" />
      ))}
    </div>
  )
}
