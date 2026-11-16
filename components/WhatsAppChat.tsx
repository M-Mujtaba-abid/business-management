'use client'

import React, { useCallback, useEffect, useRef, useState } from 'react'
import { createPortal } from 'react-dom'
import { MessageCircle, X, RefreshCw, Smartphone } from 'lucide-react'

interface ChatMessage {
  id: string
  direction: 'IN' | 'OUT'
  body: string
  orderNo: number | null
  manual: boolean
  createdAt: string
}

const time = (d: string) => new Date(d).toLocaleTimeString('en-GB', { hour: 'numeric', minute: '2-digit', hour12: true })
const day = (d: string) => {
  const date = new Date(d)
  const today = new Date()
  const yesterday = new Date(Date.now() - 86400000)
  if (date.toDateString() === today.toDateString()) return 'Today'
  if (date.toDateString() === yesterday.toDateString()) return 'Yesterday'
  return date.toLocaleDateString('en-GB', { day: 'numeric', month: 'short', year: 'numeric' })
}

// WhatsApp *bold* → <strong>, keeps line breaks
function formatBody(text: string) {
  return text.split(/(\*[^*\n]+\*)/g).map((part, i) =>
    part.length > 2 && part.startsWith('*') && part.endsWith('*') ? <strong key={i}>{part.slice(1, -1)}</strong> : part,
  )
}

// The full WhatsApp conversation with one customer (read only; refreshes every 10s while open)
export function WhatsAppChatDialog({
  phone,
  title,
  subtitle,
  onClose,
}: {
  phone: string
  title: string
  subtitle?: string
  onClose: () => void
}) {
  const [messages, setMessages] = useState<ChatMessage[] | null>(null)
  const [optedOut, setOptedOut] = useState(false)
  const [savingOpt, setSavingOpt] = useState(false)

  // The customer replied STOP; let them get order messages again (or stop them by hand)
  const toggleOptOut = async () => {
    const next = !optedOut
    if (!confirm(next ? 'Stop automatic messages to this customer?' : 'Allow automatic order messages to this customer again?')) return
    setSavingOpt(true)
    try {
      const res = await fetch('/api/whatsapp/optout', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ phone, optedOut: next }),
      })
      if (!res.ok) throw new Error((await res.json().catch(() => ({}))).error || 'Could not update')
      setOptedOut(next)
    } catch (e: any) {
      setError(e.message)
    } finally {
      setSavingOpt(false)
    }
  }
  const [error, setError] = useState<string | null>(null)
  const [loading, setLoading] = useState(false)
  const bottomRef = useRef<HTMLDivElement>(null)
  const lastCount = useRef(0)

  const load = useCallback(async () => {
    setLoading(true)
    try {
      const res = await fetch(`/api/whatsapp/chat?phone=${encodeURIComponent(phone)}`, { cache: 'no-store' })
      const data = await res.json()
      if (!res.ok) throw new Error(data.error || 'Could not load the chat')
      setMessages(data.messages)
      setOptedOut(Boolean(data.optedOut))
      setError(null)
    } catch (e: any) {
      setError(e.message || 'Could not load the chat')
    } finally {
      setLoading(false)
    }
  }, [phone])

  useEffect(() => {
    load()
    const id = setInterval(load, 10000)
    return () => clearInterval(id)
  }, [load])

  // Scroll to the newest message when new ones arrive
  useEffect(() => {
    if (messages && messages.length !== lastCount.current) {
      lastCount.current = messages.length
      bottomRef.current?.scrollIntoView({ block: 'end' })
    }
  }, [messages])

  useEffect(() => {
    const onKey = (e: KeyboardEvent) => e.key === 'Escape' && onClose()
    window.addEventListener('keydown', onKey)
    return () => window.removeEventListener('keydown', onKey)
  }, [onClose])

  let lastDay = ''

  return createPortal(
    <div className="fixed inset-0 z-[70] flex items-end sm:items-center justify-center" onClick={(e) => e.stopPropagation()}>
      <div className="absolute inset-0 bg-slate-900/40 backdrop-blur-sm" onClick={onClose} />
      <div className="relative w-full sm:max-w-md h-[85vh] sm:h-[640px] bg-white sm:rounded-2xl rounded-t-2xl shadow-xl flex flex-col overflow-hidden">
        {/* Header */}
        <div className="flex items-center gap-3 px-4 py-3 bg-emerald-600 text-white">
          <div className="h-9 w-9 rounded-full bg-white/20 flex items-center justify-center shrink-0">
            <MessageCircle className="h-5 w-5" />
          </div>
          <div className="min-w-0 flex-1">
            <div className="font-semibold text-sm truncate">{title}</div>
            <div className="text-[11px] text-emerald-100 truncate">{subtitle || phone}</div>
          </div>
          <button onClick={load} className="p-1.5 rounded-lg hover:bg-white/15" title="Refresh">
            <RefreshCw className={`h-4 w-4 ${loading ? 'animate-spin' : ''}`} />
          </button>
          <button onClick={onClose} className="p-1.5 rounded-lg hover:bg-white/15" aria-label="Close">
            <X className="h-5 w-5" />
          </button>
        </div>

        {/* Messages */}
        {optedOut && (
          <div className="flex items-center justify-between gap-2 px-4 py-2 bg-rose-50 border-b border-rose-200 text-[11px] text-rose-800">
            <span>This customer replied STOP: no automatic messages go to them.</span>
            <button
              type="button"
              onClick={toggleOptOut}
              disabled={savingOpt}
              className="shrink-0 font-semibold underline hover:text-rose-950 disabled:opacity-50"
            >
              Allow again
            </button>
          </div>
        )}

        <div className="flex-1 overflow-y-auto px-3 py-3 space-y-1.5 bg-[#efeae2]">
          {error && <div className="text-center text-xs text-rose-600 bg-white rounded-lg py-2">{error}</div>}
          {!messages && !error && <div className="text-center text-xs text-slate-500 py-8">Loading chat…</div>}
          {messages && messages.length === 0 && (
            <div className="text-center text-xs text-slate-500 bg-white/80 rounded-lg py-6 px-4">
              No messages with this customer yet.
            </div>
          )}
          {messages?.map((m) => {
            const d = day(m.createdAt)
            const showDay = d !== lastDay
            lastDay = d
            const out = m.direction === 'OUT'
            return (
              <React.Fragment key={m.id}>
                {showDay && (
                  <div className="flex justify-center py-1.5">
                    <span className="text-[10px] font-semibold text-slate-600 bg-white/90 rounded-md px-2 py-0.5 shadow-sm">{d}</span>
                  </div>
                )}
                <div className={`flex ${out ? 'justify-end' : 'justify-start'}`}>
                  <div
                    className={`max-w-[85%] rounded-lg px-2.5 py-1.5 shadow-sm text-[13px] leading-snug whitespace-pre-wrap break-words ${
                      out ? 'bg-[#d9fdd3] text-slate-900 rounded-tr-none' : 'bg-white text-slate-900 rounded-tl-none'
                    }`}
                  >
                    {formatBody(m.body)}
                    <div className="flex items-center justify-end gap-1.5 mt-0.5 text-[10px] text-slate-500">
                      {m.manual && (
                        <span className="inline-flex items-center gap-0.5" title="Typed on the business phone">
                          <Smartphone className="h-2.5 w-2.5" /> phone
                        </span>
                      )}
                      {m.orderNo && <span>#{m.orderNo}</span>}
                      <span>{time(m.createdAt)}</span>
                    </div>
                  </div>
                </div>
              </React.Fragment>
            )
          })}
          <div ref={bottomRef} />
        </div>

        <div className="px-4 py-2.5 border-t border-slate-200 text-[11px] text-slate-500 bg-white">
          To reply, use WhatsApp on the business phone. Your reply shows here too.
        </div>
      </div>
    </div>,
    document.body,
  )
}

// Small "Chat" button for an order
export function WhatsAppChatButton({
  phone,
  customerName,
  orderNo,
  compact,
}: {
  phone?: string | null
  customerName?: string | null
  orderNo?: number | null
  compact?: boolean
}) {
  const [open, setOpen] = useState(false)
  if (!phone) return null
  return (
    <>
      <button
        type="button"
        onClick={(e) => {
          e.stopPropagation()
          setOpen(true)
        }}
        title="Open the WhatsApp chat with this customer"
        className="inline-flex items-center gap-1 rounded-full border border-emerald-500/30 bg-emerald-50 px-2 py-0.5 text-[10px] font-bold text-emerald-700 hover:bg-emerald-100 transition whitespace-nowrap"
      >
        <MessageCircle className="h-3 w-3" />
        {!compact && 'Chat'}
      </button>
      {open && (
        <WhatsAppChatDialog
          phone={phone}
          title={customerName || phone}
          subtitle={`${phone}${orderNo ? ` · Order #${orderNo}` : ''}`}
          onClose={() => setOpen(false)}
        />
      )}
    </>
  )
}
