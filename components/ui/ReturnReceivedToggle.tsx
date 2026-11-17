'use client'

import React, { useEffect, useState } from 'react'
import { PackageCheck, Hourglass } from 'lucide-react'
import { toast } from 'sonner'

const DAY = 86400000

const daysSince = (d?: string | null) => (d ? Math.max(0, Math.floor((Date.now() - new Date(d).getTime()) / DAY)) : null)

const short = (d: string) => new Date(d).toLocaleDateString('en-GB', { day: 'numeric', month: 'short' })

// Small toggle under a Returned order's status: "Return pending · 4 days" ⇄ "Return received".
// The courier shows Returned days before the parcel physically reaches us; this tracks that gap.
export default function ReturnReceivedToggle({
  saleId,
  received,
  returnedAt,
  receivedAt,
  onChanged,
  compact,
}: {
  saleId: string
  received?: boolean
  returnedAt?: string | null
  receivedAt?: string | null
  onChanged?: () => void
  // narrow spaces (phone card): shorter text
  compact?: boolean
}) {
  const [isReceived, setIsReceived] = useState(Boolean(received))
  const [at, setAt] = useState<string | null>(receivedAt || null)
  const [busy, setBusy] = useState(false)

  useEffect(() => {
    setIsReceived(Boolean(received))
    setAt(receivedAt || null)
  }, [received, receivedAt])

  const toggle = async (e: React.MouseEvent) => {
    e.stopPropagation()
    const next = !isReceived
    if (!next && !confirm('Mark this return as not received yet?')) return
    setBusy(true)
    setIsReceived(next) // show it straight away; undone below if saving fails
    try {
      const res = await fetch(`/api/sales/${saleId}/return-received`, {
        method: 'PATCH',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ received: next }),
      })
      const data = await res.json().catch(() => ({}))
      if (!res.ok) throw new Error(data.error || 'Could not update the return')
      setAt(data.returnReceivedAt || null)
      toast.success(next ? 'Return received: parcel is back' : 'Return marked as pending')
      onChanged?.()
    } catch (err: any) {
      setIsReceived(!next)
      toast.error(err.message || 'Could not update the return')
    } finally {
      setBusy(false)
    }
  }

  const days = daysSince(returnedAt)
  const late = days !== null && days >= 7

  if (isReceived) {
    return (
      <button
        type="button"
        onClick={toggle}
        disabled={busy}
        title={`Parcel is back with us${at ? ` (${short(at)})` : ''}. Click to undo.`}
        className="inline-flex items-center gap-1 px-2 py-0.5 rounded-full text-[10px] font-bold border whitespace-nowrap bg-emerald-500/10 text-emerald-700 border-emerald-500/30 hover:bg-emerald-500/20 disabled:opacity-60 transition"
      >
        <PackageCheck className="h-3 w-3" />
        {compact ? 'Received' : 'Return received'}
        {at ? ` · ${short(at)}` : ''}
      </button>
    )
  }

  return (
    <button
      type="button"
      onClick={toggle}
      disabled={busy}
      title="The parcel has not reached us yet. Click when it arrives."
      className={`inline-flex items-center gap-1 px-2 py-0.5 rounded-full text-[10px] font-bold border whitespace-nowrap disabled:opacity-60 transition ${
        late
          ? 'bg-rose-50 text-rose-700 border-rose-300 hover:bg-rose-100'
          : 'bg-amber-500/10 text-amber-700 border-amber-500/30 hover:bg-amber-500/20'
      }`}
    >
      <Hourglass className="h-3 w-3" />
      {compact ? 'Pending' : 'Return pending'}
      {days !== null && (
        <span className="font-semibold opacity-80">
          · {days === 0 ? 'today' : compact ? `${days}d` : `${days} ${days === 1 ? 'day' : 'days'}`}
        </span>
      )}
      {!compact && <span className="ml-0.5 underline decoration-dotted">Got it?</span>}
    </button>
  )
}
