'use client'

import React, { useCallback, useEffect, useState } from 'react'
import { MessageCircle, RefreshCw, Search } from 'lucide-react'
import WhatsAppSettings from './WhatsAppSettings'
import WhatsAppTemplates from './WhatsAppTemplates'
import { WhatsAppChatDialog } from './WhatsAppChat'

interface Conversation {
  phone: string
  customerPhone: string
  customerName: string | null
  orderNo: number | null
  lastBody: string
  lastDirection: 'IN' | 'OUT'
  lastAt: string
  total: number
  optedOut?: boolean // replied STOP
}

const when = (d: string) => {
  const date = new Date(d)
  return date.toDateString() === new Date().toDateString()
    ? date.toLocaleTimeString('en-GB', { hour: 'numeric', minute: '2-digit', hour12: true })
    : date.toLocaleDateString('en-GB', { day: 'numeric', month: 'short' })
}

// Every customer conversation, newest first
function RecentChats() {
  const [list, setList] = useState<Conversation[] | null>(null)
  const [error, setError] = useState<string | null>(null)
  const [loading, setLoading] = useState(false)
  const [query, setQuery] = useState('')
  const [open, setOpen] = useState<Conversation | null>(null)

  const load = useCallback(async () => {
    setLoading(true)
    try {
      const res = await fetch('/api/whatsapp/chat', { cache: 'no-store' })
      const data = await res.json()
      if (!res.ok) throw new Error(data.error || 'Could not load chats')
      setList(data.conversations)
      setError(null)
    } catch (e: any) {
      setError(e.message)
    } finally {
      setLoading(false)
    }
  }, [])

  useEffect(() => {
    load()
    const id = setInterval(load, 30000)
    return () => clearInterval(id)
  }, [load])

  const q = query.trim().toLowerCase()
  const shown = (list || []).filter(
    (c) =>
      !q ||
      c.customerName?.toLowerCase().includes(q) ||
      c.phone.includes(q.replace(/\D/g, '') || '__') ||
      String(c.orderNo || '').includes(q.replace('#', '')),
  )

  return (
    <section className="rounded-2xl border border-slate-200 bg-white shadow-sm overflow-hidden">
      <div className="flex flex-wrap items-center gap-2 px-4 py-3 border-b border-slate-100">
        <div className="flex-1 min-w-[160px]">
          <h2 className="text-sm font-bold text-slate-900">Customer chats</h2>
          <p className="text-[11px] text-slate-500">Messages to and from customers. A green dot means the customer wrote last.</p>
        </div>
        <div className="flex items-center gap-1.5 rounded-lg border border-slate-200 bg-slate-50 px-2 py-1">
          <Search className="h-3.5 w-3.5 text-slate-400" />
          <input
            value={query}
            onChange={(e) => setQuery(e.target.value)}
            placeholder="Name, phone or order #"
            className="bg-transparent text-xs focus:outline-none w-40"
          />
        </div>
        <button onClick={load} className="p-1.5 rounded-lg text-slate-500 hover:bg-slate-100" title="Refresh">
          <RefreshCw className={`h-4 w-4 ${loading ? 'animate-spin' : ''}`} />
        </button>
      </div>

      {error && <div className="px-4 py-3 text-sm text-rose-600">{error}</div>}
      {!list && !error && <div className="px-4 py-6 text-sm text-slate-500">Loading chats…</div>}
      {list && shown.length === 0 && (
        <div className="px-4 py-8 text-center text-sm text-slate-500">
          {list.length ? 'No chat matches your search.' : 'No chats yet. They appear here once order messages start going out.'}
        </div>
      )}

      <ul className="divide-y divide-slate-100 max-h-[480px] overflow-y-auto">
        {shown.map((c) => (
          <li key={c.phone}>
            <button onClick={() => setOpen(c)} className="w-full flex items-center gap-3 px-4 py-2.5 text-left hover:bg-slate-50 transition">
              <div className="h-9 w-9 rounded-full bg-emerald-100 text-emerald-700 flex items-center justify-center font-bold text-sm shrink-0">
                {(c.customerName || '?').trim().charAt(0).toUpperCase()}
              </div>
              <div className="min-w-0 flex-1">
                <div className="flex items-center gap-2">
                  <span className="text-sm font-semibold text-slate-900 truncate">{c.customerName || c.customerPhone}</span>
                  {c.optedOut && (
                    <span
                      className="text-[9px] font-bold text-rose-700 bg-rose-50 border border-rose-200 rounded px-1 py-px shrink-0"
                      title="Replied STOP: gets no automatic messages"
                    >
                      STOPPED
                    </span>
                  )}
                  {c.orderNo && <span className="text-[10px] font-semibold text-slate-400 shrink-0">#{c.orderNo}</span>}
                  <span className="ml-auto text-[10px] text-slate-400 shrink-0">{when(c.lastAt)}</span>
                </div>
                <div className="flex items-center gap-2">
                  <p className="text-xs text-slate-500 truncate flex-1">
                    {c.lastDirection === 'OUT' && <span className="text-slate-400">You: </span>}
                    {c.lastBody.replace(/\s+/g, ' ')}
                  </p>
                  {c.lastDirection === 'IN' && <span className="h-2 w-2 rounded-full bg-emerald-500 shrink-0" title="Customer wrote last" />}
                </div>
              </div>
            </button>
          </li>
        ))}
      </ul>

      {open && (
        <WhatsAppChatDialog
          phone={open.phone}
          title={open.customerName || open.customerPhone}
          subtitle={`${open.customerPhone}${open.orderNo ? ` · Order #${open.orderNo}` : ''}`}
          onClose={() => {
            setOpen(null)
            load()
          }}
        />
      )}
    </section>
  )
}

// Sidebar → WhatsApp: connection, message wording and customer chats
export default function WhatsAppPage() {
  return (
    <div className="space-y-6">
      <WhatsAppSettings />
      <WhatsAppTemplates />
      <RecentChats />
      <p className="flex items-center gap-1.5 text-[11px] text-slate-400">
        <MessageCircle className="h-3.5 w-3.5" /> Open any order&apos;s Chat button to see the conversation with that customer.
      </p>
    </div>
  )
}
