'use client'

import React, { useState } from 'react'
import { CheckCircle2, XCircle, Hourglass, MessageCircle, RotateCw, AlertTriangle, Clock } from 'lucide-react'
import { toast } from 'sonner'

export type CustomerResponse = 'NONE' | 'PENDING' | 'CONFIRMED' | 'CANCELLED'
export type WhatsAppKind = 'ORDER_CONFIRM' | 'DISPATCHED' | 'DELIVERED' | 'BILL'

export interface WhatsAppMsg {
  kind: WhatsAppKind
  status: 'PENDING' | 'SENT' | 'FAILED'
  error: string | null
  sentAt: string | null
  updatedAt?: string | null
  scheduledFor?: string | null // held back by quiet hours / the daily limit until then
}

// Queued for longer than this (e.g. wa-service restarted) → offer Resend
const STUCK_MS = 10 * 60 * 1000

const KIND_LABEL: Record<WhatsAppKind, string> = {
  ORDER_CONFIRM: 'Confirm msg',
  DISPATCHED: 'Dispatch msg',
  DELIVERED: 'Review msg',
  BILL: 'Bill',
}

// Customer's answer to the WhatsApp "confirm your order" message
export function CustomerReplyBadge({ response, at }: { response?: CustomerResponse; at?: string | null }) {
  if (!response || response === 'NONE') return null
  const when = at ? new Date(at).toLocaleString('en-GB', { day: 'numeric', month: 'short', hour: 'numeric', minute: '2-digit' }) : ''
  const styles = {
    PENDING: { cls: 'bg-amber-500/10 text-amber-700 border-amber-500/30', icon: <Hourglass className="h-3 w-3" />, text: 'Awaiting reply' },
    CONFIRMED: { cls: 'bg-emerald-500/15 text-emerald-700 border-emerald-500/30', icon: <CheckCircle2 className="h-3 w-3" />, text: 'Customer confirmed' },
    CANCELLED: { cls: 'bg-rose-600 text-white border-rose-600 animate-pulse', icon: <XCircle className="h-3 w-3" />, text: 'Customer cancelled' },
  }[response]
  return (
    <span
      title={when ? `Replied on WhatsApp · ${when}` : 'Waiting for the customer to reply 1 (confirm) or 2 (cancel)'}
      className={`px-2 py-0.5 rounded-full text-[10px] font-bold border inline-flex items-center gap-1 whitespace-nowrap ${styles.cls}`}
    >
      {styles.icon}
      {styles.text}
    </span>
  )
}

// Which message to show for an order: a failed one first (needs action), else the one for its current status
const STATUS_KIND: Record<string, WhatsAppKind | undefined> = {
  PACKING: 'ORDER_CONFIRM',
  DISPATCHED: 'DISPATCHED',
  DELIVERED: 'DELIVERED',
}

// Small WhatsApp line: "Dispatch msg sent" / "Confirm msg failed · Resend"
export function WhatsAppMsgStatus({
  orderNo,
  orderStatus,
  messages,
  onChanged,
}: {
  orderNo?: number | null
  orderStatus: string
  messages?: WhatsAppMsg[]
  onChanged?: () => void
}) {
  const [busy, setBusy] = useState(false)
  // the bill has its own badge (BillStatus)
  messages = messages?.filter((m) => m.kind !== 'BILL')
  if (!orderNo || !messages?.length) return null

  // Held back on purpose (night / daily limit) until scheduledFor: not stuck before then
  const waitingUntil = (m: WhatsAppMsg) => (m.status === 'PENDING' && m.scheduledFor ? new Date(m.scheduledFor).getTime() : 0)
  const isStuck = (m: WhatsAppMsg) => {
    if (m.status !== 'PENDING' || !m.updatedAt) return false
    const since = Math.max(new Date(m.updatedAt).getTime(), waitingUntil(m))
    return Date.now() - since > STUCK_MS
  }
  const failed = messages.find((m) => m.status === 'FAILED' || isStuck(m))
  const current = messages.find((m) => m.kind === STATUS_KIND[orderStatus])
  const msg = failed || current
  if (!msg) return null

  const resend = async (e: React.MouseEvent) => {
    e.stopPropagation()
    setBusy(true)
    try {
      const res = await fetch('/api/whatsapp/resend', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ orderNo, kind: msg.kind }),
      })
      const data = await res.json().catch(() => ({}))
      if (res.ok) toast.success(`WhatsApp ${KIND_LABEL[msg.kind].toLowerCase()} queued for #${orderNo}`)
      else toast.error(data.error || 'Could not send the WhatsApp message')
      onChanged?.()
    } catch {
      toast.error('Could not reach the server')
    } finally {
      setBusy(false)
    }
  }

  if (msg === failed) {
    const stuck = msg.status === 'PENDING'
    return (
      <button
        type="button"
        onClick={resend}
        disabled={busy}
        title={stuck ? 'Queued for a long time; the WhatsApp service may have restarted' : msg.error || 'Not sent'}
        className="inline-flex items-center gap-1 text-[10px] font-semibold text-rose-600 hover:text-rose-700 disabled:opacity-50"
      >
        <AlertTriangle className="h-3 w-3 shrink-0" />
        <span className="truncate">{KIND_LABEL[msg.kind]} {stuck ? 'stuck' : 'failed'}</span>
        <span className="inline-flex items-center gap-0.5 underline shrink-0">
          <RotateCw className={`h-3 w-3 ${busy ? 'animate-spin' : ''}`} /> Resend
        </span>
      </button>
    )
  }

  const sent = msg.status === 'SENT'
  const until = waitingUntil(msg)
  if (until > Date.now()) {
    const at = new Date(until)
    const today = at.toDateString() === new Date().toDateString()
    const label = at.toLocaleString('en-GB', {
      ...(today ? {} : { weekday: 'short' }),
      hour: 'numeric',
      minute: '2-digit',
      hour12: true,
    })
    return (
      <span
        title="Held back so WhatsApp does not see a burst of messages (quiet hours or the daily limit). It goes out by itself."
        className="inline-flex items-center gap-1 text-[10px] font-semibold text-sky-700"
      >
        <Clock className="h-3 w-3 shrink-0" />
        <span className="truncate">
          {KIND_LABEL[msg.kind]} at {label}
        </span>
      </span>
    )
  }
  return (
    <span
      title={sent && msg.sentAt ? `Sent ${new Date(msg.sentAt).toLocaleString('en-GB')}` : 'Queued, sending shortly'}
      className={`inline-flex items-center gap-1 text-[10px] font-semibold ${sent ? 'text-emerald-600' : 'text-slate-400'}`}
    >
      <MessageCircle className="h-3 w-3 shrink-0" />
      <span className="truncate">
        {KIND_LABEL[msg.kind]} {sent ? 'sent' : 'sending…'}
      </span>
    </span>
  )
}

// "✓ Bill sent" / "Bill sending…" / "Bill failed" for the bill sent on WhatsApp from the Bill window
export function BillStatus({ messages }: { messages?: WhatsAppMsg[] }) {
  const bill = messages?.find((m) => m.kind === 'BILL')
  if (!bill) return null
  const when = (d?: string | null) =>
    d ? new Date(d).toLocaleString('en-GB', { day: 'numeric', month: 'short', hour: 'numeric', minute: '2-digit', hour12: true }) : ''
  if (bill.status === 'SENT') {
    return (
      <span title={`Bill sent on WhatsApp ${when(bill.sentAt)}`} className="inline-flex items-center gap-1 text-[10px] font-semibold text-emerald-600">
        <CheckCircle2 className="h-3 w-3 shrink-0" /> Bill sent
      </span>
    )
  }
  if (bill.status === 'FAILED') {
    return (
      <span title={bill.error || 'Not sent'} className="inline-flex items-center gap-1 text-[10px] font-semibold text-rose-600">
        <AlertTriangle className="h-3 w-3 shrink-0" /> Bill not sent
      </span>
    )
  }
  return (
    <span title="On its way" className="inline-flex items-center gap-1 text-[10px] font-semibold text-slate-400">
      <Hourglass className="h-3 w-3 shrink-0" /> Bill sending…
    </span>
  )
}
