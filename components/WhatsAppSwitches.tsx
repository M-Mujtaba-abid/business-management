'use client'

import React, { useEffect, useState } from 'react'
import { MessageCircle, Store } from 'lucide-react'
import { toast } from 'sonner'

interface Source {
  id: string
  name: string
  whatsappEnabled: boolean
}

function Switch({ on, onChange, label, disabled }: { on: boolean; onChange: () => void; label: string; disabled?: boolean }) {
  return (
    <button
      type="button"
      role="switch"
      aria-checked={on}
      aria-label={label}
      onClick={onChange}
      disabled={disabled}
      className={`relative h-6 w-11 shrink-0 rounded-full transition disabled:opacity-50 ${on ? 'bg-emerald-500' : 'bg-slate-300'}`}
    >
      <span className={`absolute top-0.5 h-5 w-5 rounded-full bg-white shadow transition-all ${on ? 'left-[22px]' : 'left-0.5'}`} />
    </button>
  )
}

// Settings → WhatsApp: everything on / off, and per order source (Daraz off: it forbids contacting its customers)
export default function WhatsAppSwitches() {
  const [enabled, setEnabled] = useState<boolean | null>(null)
  const [sources, setSources] = useState<Source[]>([])
  const [busy, setBusy] = useState<string | null>(null)
  const [error, setError] = useState<string | null>(null)

  useEffect(() => {
    fetch('/api/whatsapp/settings', { cache: 'no-store' })
      .then(async (r) => {
        const d = await r.json()
        if (!r.ok) throw new Error(d.error || 'Could not load')
        setEnabled(d.enabled)
        setSources(d.sources)
      })
      .catch((e) => setError(e.message))
  }, [])

  const save = async (key: string, body: object) => {
    setBusy(key)
    try {
      const res = await fetch('/api/whatsapp/settings', {
        method: 'PUT',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(body),
      })
      const data = await res.json()
      if (!res.ok) throw new Error(data.error || 'Could not save')
      return data
    } finally {
      setBusy(null)
    }
  }

  const toggleAll = async () => {
    const next = !enabled
    if (!next && !confirm('Switch WhatsApp off? No order messages or bills will go to any customer until you switch it on again.')) return
    try {
      await save('all', { enabled: next })
      setEnabled(next)
      toast.success(next ? 'WhatsApp switched on' : 'WhatsApp switched off for all customers')
    } catch (e: any) {
      toast.error(e.message)
    }
  }

  const toggleSource = async (s: Source) => {
    const next = !s.whatsappEnabled
    if (next && /daraz/i.test(s.name) && !confirm(`Daraz does not allow contacting its customers outside Daraz. Switch WhatsApp on for ${s.name} anyway?`)) return
    try {
      await save(s.id, { sourceId: s.id, whatsappEnabled: next })
      setSources((list) => list.map((x) => (x.id === s.id ? { ...x, whatsappEnabled: next } : x)))
      toast.success(`WhatsApp ${next ? 'on' : 'off'} for ${s.name} orders`)
    } catch (e: any) {
      toast.error(e.message)
    }
  }

  return (
    <section className="rounded-2xl border border-slate-200 bg-white shadow-sm overflow-hidden">
      <div className="flex items-center gap-3 px-4 py-3 border-b border-slate-100">
        <div className="h-9 w-9 rounded-xl bg-emerald-50 border border-emerald-200 text-emerald-700 flex items-center justify-center shrink-0">
          <MessageCircle className="h-4 w-4" />
        </div>
        <div className="flex-1 min-w-0">
          <h2 className="text-sm font-bold text-slate-900">WhatsApp</h2>
          <p className="text-[11px] text-slate-500">
            Off: no order messages and no bills go to customers on WhatsApp. Chats and replies are still shown.
          </p>
        </div>
        {enabled !== null && (
          <div className="flex items-center gap-2">
            <span className={`text-xs font-bold ${enabled ? 'text-emerald-700' : 'text-slate-400'}`}>{enabled ? 'On' : 'Off'}</span>
            <Switch on={enabled} onChange={toggleAll} label="WhatsApp on or off" disabled={busy === 'all'} />
          </div>
        )}
      </div>

      {error && <div className="px-4 py-3 text-sm text-rose-600">{error}</div>}

      <div className={`px-4 py-3 space-y-2 ${enabled === false ? 'opacity-50' : ''}`}>
        <div className="text-[11px] font-semibold text-slate-600">By order source</div>
        <p className="text-[11px] text-slate-500 -mt-1">
          Daraz is off: Daraz does not allow sellers to contact its customers outside Daraz, so its orders get no WhatsApp
          message and their bill shows no WhatsApp number.
        </p>
        {!sources.length && !error && <div className="text-xs text-slate-400">No order sources yet.</div>}
        <ul className="divide-y divide-slate-100 rounded-xl border border-slate-200">
          {sources.map((s) => (
            <li key={s.id} className="flex items-center gap-3 px-3 py-2">
              <Store className="h-4 w-4 text-slate-400 shrink-0" />
              <span className="flex-1 min-w-0 text-sm text-slate-800 truncate">{s.name}</span>
              <span className={`text-[11px] font-semibold ${s.whatsappEnabled ? 'text-emerald-700' : 'text-slate-400'}`}>
                {s.whatsappEnabled ? 'On' : 'Off'}
              </span>
              <Switch
                on={s.whatsappEnabled}
                onChange={() => toggleSource(s)}
                label={`WhatsApp for ${s.name} orders`}
                disabled={busy === s.id || enabled === false}
              />
            </li>
          ))}
        </ul>
        <p className="text-[11px] text-slate-400">Orders without a source follow the main switch only.</p>
      </div>
    </section>
  )
}
