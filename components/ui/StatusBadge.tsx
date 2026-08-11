'use client'

import React from 'react'
import { CheckCircle2, RotateCcw, XCircle, Truck, AlertTriangle } from 'lucide-react'

interface StatusBadgeProps {
  status: string
  type?: 'order' | 'stock'
  qty?: number
}

export default function StatusBadge({ status, type = 'order', qty }: StatusBadgeProps) {
  if (type === 'stock' && typeof qty === 'number') {
    if (qty >= 5) {
      return (
        <span className="inline-flex items-center gap-1.5 px-2.5 py-1 rounded-full text-xs font-semibold bg-emerald-500/10 text-emerald-400 border border-emerald-500/20">
          <CheckCircle2 className="h-3.5 w-3.5" />
          <span>In Stock ({qty})</span>
        </span>
      )
    }
    if (qty > 0) {
      return (
        <span className="inline-flex items-center gap-1.5 px-2.5 py-1 rounded-full text-xs font-semibold bg-amber-500/10 text-amber-400 border border-amber-500/20">
          <AlertTriangle className="h-3.5 w-3.5" />
          <span>Low Stock ({qty})</span>
        </span>
      )
    }
    return (
      <span className="inline-flex items-center gap-1.5 px-2.5 py-1 rounded-full text-xs font-semibold bg-rose-500/10 text-rose-400 border border-rose-500/20">
        <XCircle className="h-3.5 w-3.5" />
        <span>Out of Stock</span>
      </span>
    )
  }

  switch (status) {
    case 'DELIVERED':
      return (
        <span className="inline-flex items-center gap-1.5 px-2.5 py-1 rounded-full text-xs font-semibold bg-emerald-500/10 text-emerald-400 border border-emerald-500/20">
          <CheckCircle2 className="h-3.5 w-3.5" />
          <span>Delivered</span>
        </span>
      )
    case 'RETURNED':
      return (
        <span className="inline-flex items-center gap-1.5 px-2.5 py-1 rounded-full text-xs font-semibold bg-rose-500/10 text-rose-400 border border-rose-500/20">
          <RotateCcw className="h-3.5 w-3.5" />
          <span>Returned</span>
        </span>
      )
    case 'CANCELLED':
      return (
        <span className="inline-flex items-center gap-1.5 px-2.5 py-1 rounded-full text-xs font-semibold bg-slate-800 text-slate-400 border border-slate-700">
          <XCircle className="h-3.5 w-3.5" />
          <span>Cancelled</span>
        </span>
      )
    default:
      return (
        <span className="inline-flex items-center gap-1.5 px-2.5 py-1 rounded-full text-xs font-semibold bg-blue-500/10 text-blue-400 border border-blue-500/20">
          <Truck className="h-3.5 w-3.5" />
          <span>Dispatched</span>
        </span>
      )
  }
}
