'use client'

import React, { useState } from 'react'
import { Copy, Check, ExternalLink } from 'lucide-react'
import { isLeopardsCN, normalizeCN } from '@/lib/leopards'
import Hl from './Highlight'

interface CopyRefProps {
  label: string // e.g. "Daraz", "TRK"
  value: string
  className?: string
  // Tracking number: also show a button that opens the same tracking page the customer gets (Leopards only)
  track?: boolean
  // search text: the matching part is shown in green
  highlight?: string
}

// A reference number (order ID / tracking) with a one-tap copy button, e.g. to paste on the courier site
export default function CopyRef({ label, value, className = '', track = false, highlight = '' }: CopyRefProps) {
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
      <span className="truncate max-w-[140px]">
        <Hl text={value} q={highlight} />
      </span>
      <button
        type="button"
        onClick={copy}
        title={`Copy ${value}`}
        className="p-0.5 rounded text-slate-400 hover:text-slate-700 hover:bg-slate-100"
      >
        {copied ? <Check className="h-3 w-3 text-emerald-600" /> : <Copy className="h-3 w-3" />}
      </button>
      {track && isLeopardsCN(value) && (
        <a
          href={`/track/${normalizeCN(value)}`}
          target="_blank"
          rel="noopener noreferrer"
          onClick={(e) => e.stopPropagation()}
          title="Open the tracking page (same page the customer gets)"
          className="inline-flex items-center gap-0.5 px-1 py-0.5 rounded font-sans font-semibold text-[10px] text-sky-700 bg-sky-50 hover:bg-sky-100"
        >
          <ExternalLink className="h-3 w-3" /> Track
        </a>
      )}
    </span>
  )
}
