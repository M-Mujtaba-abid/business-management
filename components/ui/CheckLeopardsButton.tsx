'use client'

import React, { useState } from 'react'
import { Truck, Loader2 } from 'lucide-react'
import { toast } from 'sonner'

// Asks Leopards right now about every Packing / Dispatched order with a Leopards tracking number
// and updates them (delivered ones move to Delivered and the customer gets the WhatsApp message).
// The same check also runs by itself once a day.
export default function CheckLeopardsButton({ onChanged }: { onChanged?: () => void }) {
  const [busy, setBusy] = useState(false)

  const run = async () => {
    setBusy(true)
    try {
      const res = await fetch('/api/leopards/sync', { method: 'POST' })
      const s = await res.json().catch(() => ({}))
      if (!res.ok) throw new Error(s.error || 'Leopards check failed')

      const parts: string[] = []
      if (s.delivered?.length) parts.push(`Delivered: #${s.delivered.join(', #')}`)
      if (s.dispatched?.length) parts.push(`Dispatched: #${s.dispatched.join(', #')}`)
      if (s.updated) parts.push(`${s.updated} tracking update${s.updated > 1 ? 's' : ''}`)
      if (s.paid?.length) parts.push(`Paid by Leopards → Received: #${s.paid.join(', #')}`)
      if (s.moneyChecked) parts.push(`money checked for ${s.moneyChecked} delivered parcel${s.moneyChecked > 1 ? 's' : ''}`)

      if (s.checked === 0 && !s.moneyChecked) toast.info('No Leopards orders to check')
      else if (parts.length) toast.success(`Checked ${s.checked} parcel${s.checked > 1 ? 's' : ''}. ${parts.join(' · ')}`)
      else toast.info(`Checked ${s.checked} parcel${s.checked > 1 ? 's' : ''}: no change`)
      if (s.failed?.length) toast.warning(`Leopards did not answer for ${s.failed.join(', ')}`)

      onChanged?.()
    } catch (err: any) {
      toast.error(err.message || 'Leopards check failed')
    } finally {
      setBusy(false)
    }
  }

  return (
    <button
      onClick={run}
      disabled={busy}
      title="Ask Leopards now for the latest status of every parcel on its way (also runs by itself once a day)"
      className="shrink-0 flex items-center gap-1.5 px-3 py-2 rounded-xl border border-amber-300 bg-amber-400 text-xs font-bold text-amber-950 shadow-sm hover:bg-amber-500 transition disabled:opacity-60 whitespace-nowrap"
    >
      {busy ? <Loader2 className="h-4 w-4 animate-spin" /> : <Truck className="h-4 w-4" />}
      <span>{busy ? 'Checking…' : 'Check Leopards'}</span>
    </button>
  )
}
