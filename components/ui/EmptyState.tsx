'use client'

import React from 'react'
import { LucideIcon } from 'lucide-react'

interface EmptyStateProps {
  icon: LucideIcon
  title: string
  description: string
  actionLabel?: string
  onAction?: () => void
}

export default function EmptyState({
  icon: Icon,
  title,
  description,
  actionLabel,
  onAction,
}: EmptyStateProps) {
  return (
    <div className="p-12 text-center border border-dashed border-slate-200 rounded-2xl bg-white/40 space-y-3">
      <div className="h-12 w-12 rounded-xl bg-slate-100/80 text-slate-500 flex items-center justify-center mx-auto">
        <Icon className="h-6 w-6 text-slate-500" />
      </div>
      <div>
        <h3 className="text-sm font-bold text-slate-800">{title}</h3>
        <p className="text-xs text-slate-500 mt-1 max-w-sm mx-auto">{description}</p>
      </div>
      {actionLabel && onAction && (
        <button
          onClick={onAction}
          className="mt-2 inline-flex items-center gap-2 px-4 py-2 bg-emerald-500 hover:bg-emerald-600 text-white font-bold text-xs rounded-lg transition shadow-md shadow-emerald-500/10"
        >
          {actionLabel}
        </button>
      )}
    </div>
  )
}
