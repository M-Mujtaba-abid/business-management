'use client'

import React from 'react'
import { Truck } from 'lucide-react'
import { classifyCourierStatus, type CourierKind } from '@/lib/leopards'

// Latest Leopards status of an order (pushed by Leopards), e.g. "Leopards: Out for delivery"

const TONES: Record<CourierKind, string> = {
  transit: 'bg-sky-50 text-sky-700 border-sky-200',
  out: 'bg-indigo-50 text-indigo-700 border-indigo-200',
  delivered: 'bg-emerald-50 text-emerald-700 border-emerald-200',
  attempt: 'bg-amber-50 text-amber-700 border-amber-200',
  returning: 'bg-rose-50 text-rose-700 border-rose-200',
  returned: 'bg-rose-100 text-rose-800 border-rose-300',
}

interface Props {
  status?: string | null
  code?: string | null
  reason?: string | null
  at?: string | Date | null
  className?: string
}

export default function CourierBadge({ status, code, reason, at, className = '' }: Props) {
  if (!status && !code) return null
  const st = classifyCourierStatus(code || status)
  const when = at ? new Date(at) : null
  const title = [
    `Leopards: ${status || st.label}`,
    reason || '',
    when && !isNaN(when.getTime()) ? when.toLocaleString('en-GB', { day: 'numeric', month: 'short', hour: '2-digit', minute: '2-digit' }) : '',
  ]
    .filter(Boolean)
    .join(' · ')

  return (
    <span
      title={title}
      className={`inline-flex items-center gap-1 rounded-full border px-1.5 py-0.5 text-[10px] font-semibold whitespace-nowrap ${TONES[st.kind]} ${className}`}
    >
      <Truck className="h-3 w-3" />
      {status || st.label}
    </span>
  )
}
