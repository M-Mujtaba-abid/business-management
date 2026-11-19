'use client'

import React, { useState } from 'react'
import { Phone, Star, PhoneOff, Loader2 } from 'lucide-react'
import { toast } from 'sonner'

export type ReviewStatus = 'NONE' | 'PENDING' | 'CALLED' | 'REVIEWED' | 'DECLINED'

export const REVIEW_STEPS: { value: Exclude<ReviewStatus, 'NONE'>; label: string; tone: string }[] = [
  { value: 'PENDING', label: 'Review pending', tone: 'bg-amber-50 text-amber-800 border-amber-300' },
  { value: 'CALLED', label: 'Called customer', tone: 'bg-sky-50 text-sky-800 border-sky-300' },
  { value: 'REVIEWED', label: 'Customer reviewed', tone: 'bg-emerald-50 text-emerald-800 border-emerald-300' },
  { value: 'DECLINED', label: 'No review', tone: 'bg-slate-100 text-slate-600 border-slate-300' },
]

const ago = (iso?: string | null) => {
  if (!iso) return ''
  const mins = Math.round((Date.now() - new Date(iso).getTime()) / 60000)
  if (mins < 1) return 'just now'
  if (mins < 60) return `${mins}m ago`
  const hrs = Math.round(mins / 60)
  if (hrs < 24) return `${hrs}h ago`
  return `${Math.round(hrs / 24)}d ago`
}

// Phone numbers are saved like 03001234567; a tel: link dials them as-is
const telHref = (phone: string) => `tel:${phone.replace(/[^\d+]/g, '')}`

interface Props {
  ids: string[] // every product row of the order / parcel
  status?: ReviewStatus | null
  at?: string | null // when the step last changed
  phone?: string | null
  orderStatus: string
  onChanged?: () => void
  compact?: boolean // order list (small) vs. order drawer (roomy)
}

// Review follow-up for a delivered order: pick the step, or use the quick buttons.
// "Call" opens the phone dialer and moves the order to "Called customer" in one tap.
export default function ReviewFollowUp({ ids, status, at, phone, orderStatus, onChanged, compact }: Props) {
  const [current, setCurrent] = useState<ReviewStatus>(status || 'NONE')
  const [saving, setSaving] = useState(false)
  // Keep in step with fresh data from the list
  React.useEffect(() => setCurrent(status || 'NONE'), [status])

  if (orderStatus !== 'DELIVERED' || current === 'NONE') return null

  const setStep = async (next: Exclude<ReviewStatus, 'NONE'>) => {
    if (next === current) return
    const before = current
    setCurrent(next) // show it straight away
    setSaving(true)
    try {
      const res = await fetch('/api/sales/review', {
        method: 'PATCH',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ saleIds: ids, reviewStatus: next }),
      })
      if (!res.ok) throw new Error((await res.json().catch(() => ({}))).error || 'Could not save')
      toast.success(REVIEW_STEPS.find((s) => s.value === next)!.label)
      onChanged?.()
    } catch (err: any) {
      setCurrent(before)
      toast.error(err.message || 'Could not save')
    } finally {
      setSaving(false)
    }
  }

  const step = REVIEW_STEPS.find((s) => s.value === current)!
  const open = current === 'PENDING' || current === 'CALLED'
  const btn = compact ? 'p-1.5 rounded-lg' : 'flex-1 flex items-center justify-center gap-1.5 px-3 py-2 rounded-xl text-xs font-semibold'
  const icon = compact ? 'h-3.5 w-3.5' : 'h-4 w-4'

  return (
    <div className={compact ? 'flex flex-col items-start gap-1 min-w-0 max-w-full' : 'space-y-2'} onClick={(e) => e.stopPropagation()}>
      {/* compact (table cell): chip on its own line, time under it, so nothing spills into the next column */}
      <div className={compact ? 'flex flex-col items-start gap-0.5 min-w-0 max-w-full' : 'flex items-center gap-1.5 min-w-0'}>
        <span className="relative inline-flex items-center max-w-full">
          <Star className={`absolute left-1.5 h-3 w-3 pointer-events-none ${current === 'REVIEWED' ? 'fill-current' : ''} ${step.tone.split(' ')[1]}`} />
          <select
            value={current}
            disabled={saving}
            onChange={(e) => setStep(e.target.value as Exclude<ReviewStatus, 'NONE'>)}
            title="Review follow-up"
            className={`max-w-full truncate appearance-none cursor-pointer rounded-md border pl-5 pr-2 py-0.5 text-[10px] font-bold focus:outline-none disabled:opacity-60 ${step.tone}`}
          >
            {REVIEW_STEPS.map((s) => (
              <option key={s.value} value={s.value}>
                {s.label}
              </option>
            ))}
          </select>
        </span>
        {saving ? <Loader2 className="h-3 w-3 animate-spin text-slate-400" /> : at && <span className="text-[10px] text-slate-400 whitespace-nowrap">{ago(at)}</span>}
      </div>

      {open && (
        <div className={compact ? 'flex items-center gap-1' : 'flex gap-2'}>
          {phone && (
            <a
              href={telHref(phone)}
              onClick={() => current === 'PENDING' && setStep('CALLED')}
              title={`Call ${phone} (marks "Called customer")`}
              className={`${btn} bg-sky-50 border border-sky-200 text-sky-700 hover:bg-sky-100`}
            >
              <Phone className={icon} />
              {!compact && 'Call'}
            </a>
          )}
          <button
            onClick={() => setStep('REVIEWED')}
            disabled={saving}
            title="Customer wrote the review"
            className={`${btn} bg-emerald-50 border border-emerald-200 text-emerald-700 hover:bg-emerald-100 disabled:opacity-50`}
          >
            <Star className={icon} />
            {!compact && 'Reviewed'}
          </button>
          <button
            onClick={() => setStep('DECLINED')}
            disabled={saving}
            title="No answer / did not want to review"
            className={`${btn} bg-slate-50 border border-slate-200 text-slate-500 hover:bg-slate-100 disabled:opacity-50`}
          >
            <PhoneOff className={icon} />
            {!compact && 'No review'}
          </button>
        </div>
      )}
    </div>
  )
}
