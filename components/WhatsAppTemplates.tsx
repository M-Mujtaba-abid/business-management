'use client'

import React, { useEffect, useMemo, useRef, useState } from 'react'
import { PackageCheck, ThumbsUp, Ban, Truck, Star, Save, RotateCcw, Eye, Plus, Trash2, Shuffle } from 'lucide-react'
import { toast } from 'sonner'
import { PLACEHOLDERS, SAMPLE_VALUES, MAX_VARIANTS, renderTemplate, countSpins, type TemplateKey } from '@/lib/whatsappTemplates'

interface Template {
  key: TemplateKey
  bodies: string[]
  enabled: boolean
  isDefault: boolean
  defaultBodies: string[]
  updatedAt: string | null
}

// What each message is and when it goes out
const INFO: Record<TemplateKey, { step: string; title: string; when: string; icon: React.ElementType; tone: string }> = {
  ORDER_CONFIRM: {
    step: '1',
    title: 'Order confirmation',
    when: 'When a new order is added as Packing, or an order is moved to Packing. A poll follows it: the customer taps ✅ Confirm or ❌ Cancel (typing 1 or 2 also works). Tell them about the poll in this message.',
    icon: PackageCheck,
    tone: 'bg-amber-50 text-amber-700 border-amber-200',
  },
  REPLY_CONFIRMED: {
    step: '2a',
    title: 'Thank-you after confirm',
    when: 'Right after the customer taps ✅ Confirm on the poll (or replies 1). The order shows "Customer confirmed".',
    icon: ThumbsUp,
    tone: 'bg-emerald-50 text-emerald-700 border-emerald-200',
  },
  REPLY_CANCELLED: {
    step: '2b',
    title: 'Reply after cancel',
    when: 'Right after the customer taps ❌ Cancel on the poll (or replies 2). The order shows "Customer cancelled"; its status does not change by itself.',
    icon: Ban,
    tone: 'bg-rose-50 text-rose-700 border-rose-200',
  },
  DISPATCHED: {
    step: '3',
    title: 'Order dispatched',
    when: 'When the order status changes to Dispatched. The tracking line is left out if there is no tracking number.',
    icon: Truck,
    tone: 'bg-sky-50 text-sky-700 border-sky-200',
  },
  DELIVERED: {
    step: '4',
    title: 'Delivered + review request',
    when: 'When the order status changes to Delivered. The review link only goes to customers who have replied to us before.',
    icon: Star,
    tone: 'bg-violet-50 text-violet-700 border-violet-200',
  },
}

const same = (a: string[], b: string[]) => a.length === b.length && a.every((x, i) => x === b[i])

function TemplateCard({
  tpl,
  values,
  onSaved,
}: {
  tpl: Template
  values: Record<string, string>
  onSaved: (t: Partial<Template> & { key: TemplateKey }) => void
}) {
  const [bodies, setBodies] = useState<string[]>(tpl.bodies)
  const [enabled, setEnabled] = useState(tpl.enabled)
  const [saving, setSaving] = useState(false)
  const [showPreview, setShowPreview] = useState(false)
  const [previewIdx, setPreviewIdx] = useState(0)
  const [seed, setSeed] = useState(0) // changes → a new random preview
  const refs = useRef<(HTMLTextAreaElement | null)[]>([])
  const focused = useRef(0)
  const info = INFO[tpl.key]
  const Icon = info.icon

  useEffect(() => {
    setBodies(tpl.bodies)
    setEnabled(tpl.enabled)
  }, [tpl.bodies, tpl.enabled])

  const cleaned = bodies.map((b) => b.trim()).filter(Boolean)
  const dirty = !same(bodies, tpl.bodies) || enabled !== tpl.enabled
  const combos = cleaned.reduce((a, b) => a + countSpins(b), 0)

  const setBody = (i: number, text: string) => setBodies((list) => list.map((b, j) => (j === i ? text : b)))

  // Put a {placeholder} where the cursor is, in the box last typed in
  const insert = (tag: string) => {
    const i = Math.min(focused.current, bodies.length - 1)
    const el = refs.current[i]
    const body = bodies[i] ?? ''
    const start = el?.selectionStart ?? body.length
    const end = el?.selectionEnd ?? body.length
    setBody(i, body.slice(0, start) + tag + body.slice(end))
    requestAnimationFrame(() => {
      el?.focus()
      el?.setSelectionRange(start + tag.length, start + tag.length)
    })
  }

  const addVariant = () => {
    if (bodies.length >= MAX_VARIANTS) return
    // start from the first wording, ready to be reworded
    setBodies((list) => [...list, list[0] || ''])
    focused.current = bodies.length
    requestAnimationFrame(() => refs.current[bodies.length]?.focus())
  }

  const removeVariant = (i: number) => {
    if (bodies.length <= 1) return
    setBodies((list) => list.filter((_, j) => j !== i))
    setPreviewIdx(0)
  }

  const save = async (payload: { bodies?: string[]; enabled?: boolean; reset?: boolean }) => {
    setSaving(true)
    try {
      const res = await fetch('/api/whatsapp/templates', {
        method: 'PUT',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ key: tpl.key, ...payload }),
      })
      const data = await res.json()
      if (!res.ok) throw new Error(data.error || 'Could not save')
      onSaved({ key: tpl.key, bodies: data.bodies, enabled: data.enabled, isDefault: same(data.bodies, tpl.defaultBodies) })
      toast.success(payload.reset ? `"${info.title}" reset to the default wordings` : `"${info.title}" saved`)
    } catch (e: any) {
      toast.error(e.message || 'Could not save')
    } finally {
      setSaving(false)
    }
  }

  const previewBody = bodies[Math.min(previewIdx, bodies.length - 1)] || ''
  // a new random pick only when the text changes or Another is clicked
  // eslint-disable-next-line react-hooks/exhaustive-deps
  const preview = useMemo(() => renderTemplate(previewBody, values), [previewBody, values, seed])

  return (
    <div className={`rounded-2xl border bg-white shadow-sm overflow-hidden ${enabled ? 'border-slate-200' : 'border-slate-200 opacity-75'}`}>
      {/* Heading */}
      <div className="flex items-start gap-3 px-4 py-3 border-b border-slate-100">
        <div className={`h-9 w-9 rounded-xl border flex items-center justify-center shrink-0 ${info.tone}`}>
          <Icon className="h-4 w-4" />
        </div>
        <div className="min-w-0 flex-1">
          <h3 className="text-sm font-bold text-slate-900">
            <span className="text-slate-400 mr-1">{info.step}.</span>
            {info.title}
            {!tpl.isDefault && (
              <span className="ml-2 align-middle text-[10px] font-semibold text-sky-700 bg-sky-50 border border-sky-200 rounded-full px-1.5 py-0.5">
                Edited
              </span>
            )}
          </h3>
          <p className="text-[11px] text-slate-500 mt-0.5">
            <span className="font-semibold text-slate-600">When: </span>
            {info.when}
          </p>
          <p className="text-[11px] text-emerald-700 mt-0.5 font-medium">
            {cleaned.length} wording{cleaned.length === 1 ? '' : 's'} · about {combos.toLocaleString('en-US')} different texts
          </p>
        </div>
        <label className="flex items-center gap-1.5 shrink-0 cursor-pointer select-none" title="Turn this message on or off">
          <span className={`text-[11px] font-semibold ${enabled ? 'text-emerald-700' : 'text-slate-400'}`}>{enabled ? 'On' : 'Off'}</span>
          <button
            type="button"
            role="switch"
            aria-checked={enabled}
            aria-label={`${info.title} on or off`}
            onClick={() => setEnabled((v) => !v)}
            className={`relative h-5 w-9 rounded-full transition ${enabled ? 'bg-emerald-500' : 'bg-slate-300'}`}
          >
            <span className={`absolute top-0.5 h-4 w-4 rounded-full bg-white shadow transition-all ${enabled ? 'left-[18px]' : 'left-0.5'}`} />
          </button>
        </label>
      </div>

      {/* Wordings */}
      <div className="p-4 space-y-3">
        {bodies.map((body, i) => (
          <div key={i} className="space-y-1">
            <div className="flex items-center justify-between">
              <label htmlFor={`${tpl.key}-${i}`} className="text-[11px] font-semibold text-slate-600">
                Wording {i + 1}
              </label>
              {bodies.length > 1 && (
                <button
                  type="button"
                  onClick={() => removeVariant(i)}
                  className="inline-flex items-center gap-1 text-[11px] font-semibold text-slate-400 hover:text-rose-600"
                  aria-label={`Remove wording ${i + 1}`}
                >
                  <Trash2 className="h-3 w-3" /> Remove
                </button>
              )}
            </div>
            <textarea
              id={`${tpl.key}-${i}`}
              ref={(el) => {
                refs.current[i] = el
              }}
              value={body}
              onFocus={() => {
                focused.current = i
                setPreviewIdx(i)
              }}
              onChange={(e) => setBody(i, e.target.value)}
              rows={Math.min(12, Math.max(3, body.split('\n').length + 1))}
              className="w-full rounded-xl border border-slate-300 bg-slate-50 px-3 py-2.5 text-[13px] leading-relaxed text-slate-800 font-mono focus:outline-none focus:border-emerald-500 focus:bg-white resize-y"
              spellCheck={false}
            />
          </div>
        ))}

        {bodies.length < MAX_VARIANTS && (
          <button
            type="button"
            onClick={addVariant}
            className="w-full inline-flex items-center justify-center gap-1.5 rounded-xl border border-dashed border-emerald-400 text-emerald-700 text-xs font-semibold py-2 hover:bg-emerald-50"
          >
            <Plus className="h-3.5 w-3.5" /> Add another wording
          </button>
        )}

        <div className="flex flex-wrap gap-1.5">
          {PLACEHOLDERS.map((p) => (
            <button
              key={p.tag}
              type="button"
              onClick={() => insert(p.tag)}
              title={`Insert: ${p.label}`}
              className="text-[11px] font-mono font-semibold text-emerald-700 bg-emerald-50 border border-emerald-200 rounded-md px-1.5 py-0.5 hover:bg-emerald-100"
            >
              {p.tag}
            </button>
          ))}
        </div>

        {showPreview && (
          <div className="rounded-xl bg-[#efeae2] p-3">
            <div className="max-w-[90%] ml-auto rounded-lg rounded-tr-none bg-[#d9fdd3] px-3 py-2 text-[13px] leading-snug text-slate-900 whitespace-pre-wrap break-words shadow-sm">
              {preview || <span className="text-slate-400 italic">Empty message</span>}
            </div>
            <div className="flex items-center justify-between mt-2">
              <p className="text-[10px] text-slate-500">
                Wording {Math.min(previewIdx, bodies.length - 1) + 1}, sample order. Each send picks words at random.
              </p>
              <button
                type="button"
                onClick={() => setSeed((s) => s + 1)}
                className="inline-flex items-center gap-1 text-[11px] font-semibold text-emerald-700 hover:text-emerald-900"
              >
                <Shuffle className="h-3 w-3" /> Another
              </button>
            </div>
          </div>
        )}

        <div className="flex flex-wrap items-center gap-2">
          <button
            type="button"
            onClick={() => save({ bodies: cleaned, enabled })}
            disabled={!dirty || saving || !cleaned.length}
            className="inline-flex items-center gap-1.5 rounded-lg bg-emerald-500 hover:bg-emerald-600 disabled:bg-slate-200 disabled:text-slate-400 text-white text-xs font-semibold px-3 py-1.5 transition"
          >
            <Save className="h-3.5 w-3.5" /> {saving ? 'Saving…' : 'Save'}
          </button>
          <button
            type="button"
            onClick={() => setShowPreview((v) => !v)}
            className="inline-flex items-center gap-1.5 rounded-lg border border-slate-200 bg-white hover:bg-slate-50 text-slate-700 text-xs font-semibold px-3 py-1.5"
          >
            <Eye className="h-3.5 w-3.5" /> {showPreview ? 'Hide preview' : 'Preview'}
          </button>
          {dirty && (
            <button
              type="button"
              onClick={() => {
                setBodies(tpl.bodies)
                setEnabled(tpl.enabled)
              }}
              className="text-xs font-semibold text-slate-500 hover:text-slate-800 px-1"
            >
              Discard changes
            </button>
          )}
          {!tpl.isDefault && (
            <button
              type="button"
              onClick={() => confirm(`Reset "${info.title}" to the original wordings?`) && save({ reset: true })}
              disabled={saving}
              className="ml-auto inline-flex items-center gap-1 text-xs font-semibold text-slate-500 hover:text-rose-600"
            >
              <RotateCcw className="h-3.5 w-3.5" /> Reset to default
            </button>
          )}
        </div>
      </div>
    </div>
  )
}

// Editable wording of every automatic WhatsApp message
export default function WhatsAppTemplates() {
  const [templates, setTemplates] = useState<Template[] | null>(null)
  const [values, setValues] = useState<Record<string, string>>(SAMPLE_VALUES)
  const [error, setError] = useState<string | null>(null)

  useEffect(() => {
    fetch('/api/whatsapp/templates', { cache: 'no-store' })
      .then(async (res) => {
        const data = await res.json()
        if (!res.ok) throw new Error(data.error || 'Could not load the messages')
        setTemplates(data.templates)
        // Real business name / review link when they are set on the server
        setValues({
          ...SAMPLE_VALUES,
          ...(data.values?.reviewUrl ? { reviewUrl: data.values.reviewUrl } : {}),
          ...(data.values?.business ? { business: data.values.business } : {}),
        })
      })
      .catch((e) => setError(e.message))
  }, [])

  return (
    <section className="space-y-4">
      <div className="space-y-1.5">
        <h2 className="text-base font-bold text-slate-900">Customer messages</h2>
        <p className="text-xs text-slate-500">
          These go out automatically, in this order. Click a <span className="font-mono text-emerald-700">{'{tag}'}</span> to add the
          order&apos;s details; a line whose detail is empty (like a missing tracking number) is left out. Write{' '}
          <span className="font-mono">*text*</span> for bold. Each message goes to a customer once per order.
        </p>
        <div className="rounded-xl border border-amber-200 bg-amber-50 px-3 py-2 text-[11px] text-amber-900 leading-relaxed">
          <b>Avoid the same text every time.</b> WhatsApp flags one text sent to many people. Give each message 3 or more wordings
          (one is picked at random, never the same twice in a row), and put choices in curly brackets with a bar between them:{' '}
          <span className="font-mono bg-white/70 px-1 rounded">{'{Salam|AoA|Assalam o Alaikum}'}</span>: one is picked each time.
        </div>
      </div>

      {error && <div className="rounded-xl border border-rose-200 bg-rose-50 text-rose-700 text-sm px-4 py-3">{error}</div>}
      {!templates && !error && <div className="text-sm text-slate-500">Loading messages…</div>}

      <div className="grid gap-4 xl:grid-cols-2">
        {templates?.map((t) => (
          <TemplateCard
            key={t.key}
            tpl={t}
            values={values}
            onSaved={(u) => setTemplates((list) => list?.map((x) => (x.key === u.key ? { ...x, ...u } : x)) ?? null)}
          />
        ))}
      </div>
    </section>
  )
}
