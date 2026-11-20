'use client'

import React, { useEffect, useState } from 'react'
import { MessageSquareText, Plus, Trash2, Send, Eye, Loader2 } from 'lucide-react'
import { toast } from 'sonner'

// Settings → Daily WhatsApp report: who gets it, morning (9 am) / night (10 pm), preview and test.

interface Recipient {
  name: string
  phone: string
}

function Toggle({ on, onChange, disabled }: { on: boolean; onChange: (v: boolean) => void; disabled?: boolean }) {
  return (
    <button
      type="button"
      disabled={disabled}
      onClick={() => onChange(!on)}
      className={`relative h-6 w-11 shrink-0 rounded-full transition disabled:opacity-50 ${on ? 'bg-emerald-500' : 'bg-slate-300'}`}
    >
      <span className={`absolute top-0.5 h-5 w-5 rounded-full bg-white shadow transition-all ${on ? 'left-[22px]' : 'left-0.5'}`} />
    </button>
  )
}

export default function DailyReportSettings() {
  const [recipients, setRecipients] = useState<Recipient[]>([])
  const [morning, setMorning] = useState(true)
  const [night, setNight] = useState(true)
  const [leopardsPayment, setLeopardsPayment] = useState(true)
  const [loading, setLoading] = useState(true)
  const [saving, setSaving] = useState(false)
  const [sending, setSending] = useState<'' | 'morning' | 'night' | 'leopards'>('')
  const [preview, setPreview] = useState<{ slot: string; text: string } | null>(null)

  useEffect(() => {
    Promise.all([fetch('/api/reports').then((r) => r.json()), fetch('/api/people').then((r) => r.json())])
      .then(([s, people]) => {
        setMorning(s.morning !== false)
        setNight(s.night !== false)
        setLeopardsPayment(s.leopardsPayment !== false)
        // start with one empty row per person (Mujtaba, Noman) when nothing is saved yet
        setRecipients(s.recipients?.length ? s.recipients : Array.isArray(people) ? people.map((p: any) => ({ name: p.name, phone: '' })) : [])
      })
      .catch(() => toast.error('Could not load the report settings'))
      .finally(() => setLoading(false))
  }, [])

  const save = async (patch: Record<string, unknown>, msg = 'Saved') => {
    setSaving(true)
    try {
      const res = await fetch('/api/reports', { method: 'PUT', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify(patch) })
      const d = await res.json()
      if (!res.ok) throw new Error(d.error || 'Could not save')
      toast.success(msg)
      return true
    } catch (e: any) {
      toast.error(e.message)
      return false
    } finally {
      setSaving(false)
    }
  }

  const showPreview = async (slot: 'morning' | 'night' | 'leopards') => {
    try {
      const d = await fetch(`/api/reports?preview=${slot}`).then((r) => r.json())
      if (d.error) throw new Error(d.error)
      setPreview({ slot, text: d.preview })
    } catch (e: any) {
      toast.error(e.message)
    }
  }

  const sendNow = async (slot: 'morning' | 'night' | 'leopards') => {
    if (!(await save({ recipients }, 'Numbers saved'))) return
    setSending(slot)
    try {
      const res = await fetch('/api/reports', { method: 'POST', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify({ slot }) })
      const d = await res.json()
      if (!res.ok) throw new Error(d.error || 'Not sent')
      toast.success(
        `${slot === 'morning' ? 'Morning report' : slot === 'night' ? 'Night report' : 'Leopards payment alert example'} sent to ${d.sent} number${d.sent > 1 ? 's' : ''}`
      )
      if (d.errors?.length) toast.warning(d.errors.join(' · '))
    } catch (e: any) {
      toast.error(e.message)
    } finally {
      setSending('')
    }
  }

  const input = 'w-full bg-white border border-slate-300 rounded-lg px-3 py-2 text-sm focus:outline-none focus:border-emerald-500'

  return (
    <section className="rounded-2xl border border-slate-200 bg-white shadow-sm overflow-hidden">
      <div className="flex items-center gap-3 px-4 py-3 border-b border-slate-100">
        <div className="h-9 w-9 rounded-xl bg-emerald-50 border border-emerald-200 text-emerald-700 flex items-center justify-center shrink-0">
          <MessageSquareText className="h-4 w-4" />
        </div>
        <div className="flex-1 min-w-0">
          <h2 className="text-sm font-bold text-slate-900">Daily WhatsApp report</h2>
          <p className="text-xs text-slate-500">Sent from your business WhatsApp to the owners · 9 am, 10 pm, and instant Leopards payment alerts</p>
        </div>
      </div>

      {loading ? (
        <div className="flex justify-center py-6 text-slate-400">
          <Loader2 className="h-4 w-4 animate-spin" />
        </div>
      ) : (
        <div className="p-4 space-y-4">
          {/* Who gets it */}
          <div className="space-y-2">
            <div className="text-xs font-semibold text-slate-700">Send to</div>
            {recipients.map((r, i) => (
              <div key={i} className="grid grid-cols-[1fr_1.4fr_auto] gap-2">
                <input value={r.name} onChange={(e) => setRecipients(recipients.map((x, j) => (j === i ? { ...x, name: e.target.value } : x)))} placeholder="Name" className={input} />
                <input
                  value={r.phone}
                  onChange={(e) => setRecipients(recipients.map((x, j) => (j === i ? { ...x, phone: e.target.value } : x)))}
                  placeholder="WhatsApp number, e.g. 0300 1234567"
                  inputMode="tel"
                  className={input}
                />
                <button onClick={() => setRecipients(recipients.filter((_, j) => j !== i))} className="p-2 text-slate-400 hover:text-rose-600" title="Remove">
                  <Trash2 className="h-4 w-4" />
                </button>
              </div>
            ))}
            <div className="flex items-center gap-3">
              <button onClick={() => setRecipients([...recipients, { name: '', phone: '' }])} className="flex items-center gap-1 text-xs font-semibold text-emerald-700 hover:underline">
                <Plus className="h-3.5 w-3.5" /> Add number
              </button>
              <button onClick={() => save({ recipients }, 'Numbers saved')} disabled={saving} className="ml-auto rounded-lg bg-emerald-600 px-3 py-1.5 text-xs font-bold text-white disabled:opacity-50">
                {saving ? 'Saving…' : 'Save numbers'}
              </button>
            </div>
          </div>

          {/* Morning / night */}
          {(
            [
              ['morning', '☀️ Morning (9:00 am)', "Yesterday's orders, deliveries, profit, In hand + every order still Packing / Dispatched", morning, setMorning],
              ['night', '🌙 Night (10:00 pm)', "Today's new orders, deliveries, profit and In hand", night, setNight],
              [
                'leopards',
                '💰 Leopards payment alert (instant)',
                'When Leopards makes an invoice or pays: invoice no., each order no. with amount, total and whose account',
                leopardsPayment,
                setLeopardsPayment,
              ],
            ] as const
          ).map(([slot, title, sub, on, setOn]) => (
            <div key={slot} className="flex flex-wrap items-center gap-3 rounded-xl border border-slate-200 px-3 py-2.5">
              <Toggle
                on={on}
                disabled={saving}
                onChange={async (v) => {
                  setOn(v)
                  const field = slot === 'leopards' ? 'leopardsPayment' : slot
                  if (!(await save({ [field]: v }, `${title.split(' (')[0]} ${v ? 'on' : 'off'}`))) setOn(!v)
                }}
              />
              <div className="min-w-0 flex-1">
                <div className="text-sm font-semibold text-slate-800">{title}</div>
                <div className="text-[11px] text-slate-500">{sub}</div>
              </div>
              <button onClick={() => showPreview(slot)} className="flex items-center gap-1 rounded-lg border border-slate-200 px-2.5 py-1.5 text-[11px] font-semibold text-slate-600 hover:bg-slate-50">
                <Eye className="h-3.5 w-3.5" /> Preview
              </button>
              <button
                onClick={() => sendNow(slot)}
                disabled={!!sending}
                className="flex items-center gap-1 rounded-lg border border-emerald-200 bg-emerald-50 px-2.5 py-1.5 text-[11px] font-semibold text-emerald-700 hover:bg-emerald-100 disabled:opacity-50"
              >
                {sending === slot ? <Loader2 className="h-3.5 w-3.5 animate-spin" /> : <Send className="h-3.5 w-3.5" />} Send test now
              </button>
            </div>
          ))}

          {preview && (
            <div className="rounded-xl border border-emerald-200 bg-[#e7fce3] p-3">
              <div className="mb-1 flex items-center text-[11px] font-semibold text-emerald-800">
                Preview · {preview.slot}
                <button onClick={() => setPreview(null)} className="ml-auto text-slate-500 hover:text-slate-800">
                  close
                </button>
              </div>
              <pre className="whitespace-pre-wrap font-sans text-[13px] leading-relaxed text-slate-800">{preview.text}</pre>
            </div>
          )}
          <p className="text-[10px] text-slate-400">The time can be up to an hour late (Vercel runs daily jobs within the hour). Before each report the app also checks Leopards.</p>
        </div>
      )}
    </section>
  )
}
