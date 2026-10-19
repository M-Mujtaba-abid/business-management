'use client'

import React, { useState } from 'react'
import { Copy, Check } from 'lucide-react'

interface CopyRefProps {
  label: string // e.g. "Daraz", "TRK"
  value: string
  className?: string
}

// A reference number (order ID / tracking) with a one-tap copy button, e.g. to paste on the courier site
export default function CopyRef({ label, value, className = '' }: CopyRefProps) {
  const [copied, setCopied] = useState(false)

  const copy = async (e: React.MouseEvent) => {
    e.stopPropagation()
    try {
      await navigator.clipboard.writeText(value)
      setCopied(true)
      setTimeout(() => setCopied(false), 1200)
    } catch {
      // clipboard blocked (e.g. insecure context): nothing to do
    }
  }

  return (
    <span className={`inline-flex items-center gap-1 font-mono text-[11px] text-slate-600 ${className}`}>
      <span className="text-slate-400 font-sans">{label}</span>
      <span className="truncate max-w-[140px]">{value}</span>
      <button
        type="button"
        onClick={copy}
        title={`Copy ${value}`}
        className="p-0.5 rounded text-slate-400 hover:text-slate-700 hover:bg-slate-100"
      >
        {copied ? <Check className="h-3 w-3 text-emerald-600" /> : <Copy className="h-3 w-3" />}
      </button>
    </span>
  )
}
