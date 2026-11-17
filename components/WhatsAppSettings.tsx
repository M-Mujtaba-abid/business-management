'use client'

import React, { useCallback, useEffect, useState } from 'react'
import { MessageCircle, RefreshCw, LogOut, CheckCircle2, AlertTriangle, QrCode } from 'lucide-react'
import { toast } from 'sonner'

interface WaStatus {
  configured: boolean
  reachable: boolean
  connected: boolean
  loggedIn: boolean
  phone?: string | null
  hasQR?: boolean
  queue?: number
  todayChats?: number
  dailyLimit?: number
  quietNow?: boolean
  quietStart?: number
  quietEnd?: number
  error?: string
}

const hour12 = (h: number) => `${h % 12 || 12} ${h < 12 ? 'am' : 'pm'}`

// WhatsApp link status, and the QR code to scan (WhatsApp → Linked devices → Link a device)
export default function WhatsAppSettings() {
  const [status, setStatus] = useState<WaStatus | null>(null)
  const [qrTick, setQrTick] = useState(0) // changes the QR image URL so it reloads
  const [busy, setBusy] = useState(false)

  const load = useCallback(async () => {
    try {
      const res = await fetch('/api/whatsapp/status', { cache: 'no-store' })
      setStatus(await res.json())
      setQrTick((t) => t + 1)
    } catch {
      setStatus({ configured: true, reachable: false, connected: false, loggedIn: false })
    }
  }, [])

  // QR codes rotate every ~20s while pairing; check more often until linked
  useEffect(() => {
    load()
    const linked = status?.loggedIn && status?.connected
    const id = setInterval(load, linked ? 30000 : 5000)
    return () => clearInterval(id)
  }, [load, status?.loggedIn, status?.connected])

  const logout = async () => {
    if (!confirm('Unlink this WhatsApp number? Customers will stop getting order messages until you scan again.')) return
    setBusy(true)
    try {
      const res = await fetch('/api/whatsapp/status', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ action: 'logout' }),
      })
      if (res.ok) toast.success('WhatsApp unlinked')
      else toast.error((await res.json().catch(() => ({}))).error || 'Could not unlink')
      load()
    } finally {
      setBusy(false)
    }
  }

  let tone = 'bg-slate-100 text-slate-600 border-slate-200'
  let label = 'Checking…'
  let icon = <RefreshCw className="h-4 w-4 animate-spin" />
  if (status) {
    if (!status.configured) {
      tone = 'bg-slate-100 text-slate-600 border-slate-200'
      label = 'Not set up'
      icon = <AlertTriangle className="h-4 w-4" />
    } else if (!status.reachable) {
      tone = 'bg-rose-50 text-rose-700 border-rose-200'
      label = 'Service offline'
      icon = <AlertTriangle className="h-4 w-4" />
    } else if (status.loggedIn && status.connected) {
      tone = 'bg-emerald-50 text-emerald-700 border-emerald-200'
      label = 'Connected'
      icon = <CheckCircle2 className="h-4 w-4" />
    } else if (status.loggedIn) {
      tone = 'bg-amber-50 text-amber-700 border-amber-200'
      label = 'Reconnecting…'
      icon = <RefreshCw className="h-4 w-4 animate-spin" />
    } else {
      tone = 'bg-amber-50 text-amber-700 border-amber-200'
      label = 'Scan QR to link'
      icon = <QrCode className="h-4 w-4" />
    }
  }

  return (
    <div className="bg-white border border-slate-200 rounded-2xl shadow-sm p-4 sm:p-5 space-y-4">
      <div className="flex flex-wrap items-center justify-between gap-3">
        <div className="flex items-center gap-3 min-w-0">
          <div className="w-10 h-10 rounded-xl bg-emerald-500/10 text-emerald-600 flex items-center justify-center shrink-0">
            <MessageCircle className="h-5 w-5" />
          </div>
          <div className="min-w-0">
            <h2 className="text-sm font-bold text-slate-900">WhatsApp order messages</h2>
            <p className="text-[11px] text-slate-500">
              Confirm (Packing), dispatched and delivered/review messages go to the customer automatically.
            </p>
          </div>
        </div>
        <span className={`inline-flex items-center gap-1.5 px-3 py-1.5 rounded-xl border text-xs font-semibold ${tone}`}>
          {icon}
          {label}
        </span>
      </div>

      {status && !status.configured && (
        <p className="text-xs text-slate-600 bg-slate-50 border border-slate-200 rounded-xl p-3">
          Add <code className="font-mono">WA_SERVICE_URL</code>, <code className="font-mono">WA_API_SECRET</code> and{' '}
          <code className="font-mono">WA_WEBHOOK_SECRET</code> to the app&apos;s environment, and run the wa-service (see{' '}
          <code className="font-mono">wa-service/README.md</code>).
        </p>
      )}

      {status?.configured && !status.reachable && (
        <p className="text-xs text-rose-700 bg-rose-50 border border-rose-200 rounded-xl p-3">
          The WhatsApp service can&apos;t be reached. Orders still save; their messages show &quot;failed&quot; with a Resend button.
          {status.error ? <span className="block mt-1 text-rose-500 font-mono text-[11px]">{status.error}</span> : null}
        </p>
      )}

      {status?.reachable && status.loggedIn && (
        <div className="flex flex-wrap items-center justify-between gap-3 text-xs">
          <span className="text-slate-600">
            Linked number: <b className="font-mono text-slate-900">{status.phone ? `+${status.phone}` : '—'}</b>
            {typeof status.queue === 'number' && status.queue > 0 && <span className="ml-2 text-slate-400">· {status.queue} message(s) in queue</span>}
          </span>
          {typeof status.dailyLimit === 'number' && (
            <span className="w-full sm:w-auto order-last sm:order-none text-[11px] text-slate-500">
              Today: <b className="text-slate-700">{status.todayChats ?? 0}</b>
              {status.dailyLimit > 0 ? ` / ${status.dailyLimit}` : ''} customers messaged automatically
              {typeof status.quietStart === 'number' && typeof status.quietEnd === 'number' && status.quietStart !== status.quietEnd && (
                <span className={status.quietNow ? 'ml-1 text-sky-700 font-semibold' : 'ml-1'}>
                  · {status.quietNow ? 'Night pause now' : 'Night pause'} {hour12(status.quietStart)}–{hour12(status.quietEnd)}
                </span>
              )}
            </span>
          )}
          <button
            onClick={logout}
            disabled={busy}
            className="inline-flex items-center gap-1.5 px-3 py-1.5 rounded-xl border border-rose-200 text-rose-600 font-semibold hover:bg-rose-50 disabled:opacity-50"
          >
            <LogOut className="h-3.5 w-3.5" /> Unlink
          </button>
        </div>
      )}

      {status?.reachable && !status.loggedIn && (
        <div className="flex flex-col sm:flex-row items-center gap-4">
          {status.hasQR ? (
            // eslint-disable-next-line @next/next/no-img-element
            <img
              src={`/api/whatsapp/status?qr=1&t=${qrTick}`}
              alt="WhatsApp pairing QR code"
              className="w-56 h-56 rounded-xl border border-slate-200 bg-white p-2"
            />
          ) : (
            <div className="w-56 h-56 rounded-xl border border-dashed border-slate-200 flex items-center justify-center text-xs text-slate-400">
              Waiting for QR…
            </div>
          )}
          <ol className="text-xs text-slate-600 space-y-1.5 list-decimal list-inside">
            <li>Open WhatsApp on the business phone</li>
            <li>Settings → <b>Linked devices</b> → <b>Link a device</b></li>
            <li>Scan this QR code (it refreshes by itself)</li>
          </ol>
        </div>
      )}
    </div>
  )
}
