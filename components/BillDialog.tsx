'use client'

import React, { useEffect, useRef, useState } from 'react'
import { createPortal } from 'react-dom'
import { Download, Share2, Send, X, ReceiptText, Loader2, CheckCircle2, AlertTriangle } from 'lucide-react'
import { toast } from 'sonner'

interface BillDialogProps {
  saleId: string
  orderNo?: number | null
  customerName?: string | null
  customerPhone?: string | null
  onClose: () => void
}

// 0300-1234567 / +92 300… → 923001234567 (for a wa.me link)
const waNumber = (v?: string | null) => {
  let d = (v || '').replace(/\D/g, '')
  if (d.startsWith('00')) d = d.slice(2)
  if (d.length === 11 && d.startsWith('0')) d = '92' + d.slice(1)
  else if (d.length === 10 && d.startsWith('3')) d = '92' + d
  return d.length >= 11 && d.length <= 13 ? d : ''
}

// Bill window: optional delivery charge, a live preview, and Download / Share / Send on WhatsApp
export default function BillDialog({ saleId, orderNo, customerName, customerPhone, onClose }: BillDialogProps) {
  const [delivery, setDelivery] = useState('')
  const [debounced, setDebounced] = useState('')
  const [loading, setLoading] = useState(true)
  const [failed, setFailed] = useState(false)
  const [busy, setBusy] = useState<'share' | 'send' | 'download' | null>(null)
  const input = useRef<HTMLInputElement>(null)
  // The bill sent on WhatsApp for this order (if any): shown above the buttons
  const [sent, setSent] = useState<{ status: string; error: string | null; sentAt: string | null } | null>(null)
  const [checkTick, setCheckTick] = useState(0)
  // Why WhatsApp is not allowed for this order (WhatsApp off, or e.g. Daraz), null = allowed
  const [blocked, setBlocked] = useState<string | null>(null)

  useEffect(() => {
    fetch(`/api/sales/${saleId}/bill/whatsapp`, { cache: 'no-store' })
      .then((r) => r.json())
      .then((d) => setBlocked(d?.allowed === false ? d.reason || 'WhatsApp is off for this order.' : null))
      .catch(() => undefined)
  }, [saleId])

  useEffect(() => {
    if (!orderNo) return
    let cancelled = false
    const check = async () => {
      try {
        const res = await fetch(`/api/whatsapp/order-status?orderNos=${orderNo}`, { cache: 'no-store' })
        const data = await res.json()
        const bill = data?.orders?.[orderNo]?.whatsapp?.find((m: { kind: string }) => m.kind === 'BILL')
        if (!cancelled) setSent(bill ? { status: bill.status, error: bill.error, sentAt: bill.sentAt } : null)
      } catch {
        // status is only informative
      }
    }
    check()
    return () => {
      cancelled = true
    }
  }, [orderNo, checkTick])

  // While the bill is on its way, check again every 3 seconds
  useEffect(() => {
    if (sent?.status !== 'PENDING') return
    const t = setTimeout(() => setCheckTick((n) => n + 1), 3000)
    return () => clearTimeout(t)
  }, [sent, checkTick])

  // Redraw the preview shortly after typing stops
  useEffect(() => {
    const t = setTimeout(() => setDebounced(delivery), 450)
    return () => clearTimeout(t)
  }, [delivery])

  useEffect(() => {
    const onKey = (e: KeyboardEvent) => e.key === 'Escape' && onClose()
    window.addEventListener('keydown', onKey)
    return () => window.removeEventListener('keydown', onKey)
  }, [onClose])

  const amount = parseFloat(debounced)
  const deliveryValue = Number.isFinite(amount) && amount > 0 ? amount : 0
  const invalid = delivery.trim() !== '' && !(parseFloat(delivery) >= 0)
  const billUrl = (download = false) =>
    `/api/sales/${saleId}/bill?delivery=${deliveryValue}${download ? '&download=1' : ''}`
  const previewUrl = `${billUrl()}&v=${deliveryValue}`
  const fileName = `FancyStore-Bill-${orderNo ?? 'order'}.png`

  useEffect(() => {
    setLoading(true)
    setFailed(false)
  }, [previewUrl])

  const fetchBill = async () => {
    const res = await fetch(billUrl(), { cache: 'no-store' })
    if (!res.ok) throw new Error((await res.json().catch(() => ({}))).error || 'Could not make the bill')
    return res.blob()
  }

  const saveBlob = (blob: Blob) => {
    const url = URL.createObjectURL(blob)
    const a = document.createElement('a')
    a.href = url
    a.download = fileName
    document.body.appendChild(a)
    a.click()
    a.remove()
    setTimeout(() => URL.revokeObjectURL(url), 2000)
  }

  const download = async () => {
    setBusy('download')
    try {
      saveBlob(await fetchBill())
      toast.success('Bill downloaded')
    } catch (e: any) {
      toast.error(e.message)
    } finally {
      setBusy(null)
    }
  }

  // Phone: the share sheet (WhatsApp, etc.) with the picture. Computer: save it and open the customer's chat.
  const share = async () => {
    setBusy('share')
    try {
      const blob = await fetchBill()
      const file = new File([blob], fileName, { type: 'image/png' })
      const nav = navigator as Navigator & { canShare?: (d: ShareData) => boolean }
      if (nav.share && nav.canShare?.({ files: [file] })) {
        try {
          await nav.share({ files: [file], title: `Bill #${orderNo ?? ''}` })
        } catch (err: any) {
          if (err?.name !== 'AbortError') throw err
        }
        return
      }
      saveBlob(blob)
      if (blocked) {
        toast.success('Bill saved')
        return // WhatsApp is off for this order (e.g. Daraz): no WhatsApp chat
      }
      const to = waNumber(customerPhone)
      const text = encodeURIComponent(`Assalam o Alaikum${customerName ? ` ${customerName}` : ''}! Aapke order #${orderNo ?? ''} ka bill.`)
      window.open(to ? `https://wa.me/${to}?text=${text}` : `https://wa.me/?text=${text}`, '_blank', 'noopener')
      toast.success('Bill saved. Attach it in the WhatsApp chat that just opened.')
    } catch (e: any) {
      toast.error(e.message || 'Could not share the bill')
    } finally {
      setBusy(null)
    }
  }

  // Straight to the customer from the linked business number
  const sendWhatsApp = async () => {
    if (!confirm(`Send this bill to ${customerName || 'the customer'} on WhatsApp?`)) return
    setBusy('send')
    try {
      const res = await fetch(`/api/sales/${saleId}/bill/whatsapp`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ delivery: deliveryValue }),
      })
      const data = await res.json().catch(() => ({}))
      if (!res.ok) throw new Error(data.error || 'Could not send the bill')
      toast.success('Bill is on its way on WhatsApp')
      setSent({ status: 'PENDING', error: null, sentAt: null })
      setCheckTick((n) => n + 1)
    } catch (e: any) {
      toast.error(e.message)
    } finally {
      setBusy(null)
    }
  }

  const btn =
    'flex-1 min-w-[120px] inline-flex items-center justify-center gap-1.5 rounded-xl px-3 py-2.5 text-sm font-semibold transition disabled:opacity-50'

  return createPortal(
    <div className="fixed inset-0 z-[70] flex items-end sm:items-center justify-center" onClick={(e) => e.stopPropagation()}>
      <div className="absolute inset-0 bg-slate-900/40 backdrop-blur-sm" onClick={onClose} />
      <div className="relative w-full sm:max-w-lg max-h-[95vh] bg-white sm:rounded-2xl rounded-t-2xl shadow-xl flex flex-col overflow-hidden">
        <div className="flex items-center gap-2 px-4 py-3 border-b border-slate-200">
          <ReceiptText className="h-5 w-5 text-teal-700" />
          <div className="flex-1 min-w-0">
            <div className="text-sm font-bold text-slate-900">Bill · Order #{orderNo ?? '—'}</div>
            <div className="text-[11px] text-slate-500 truncate">{customerName}</div>
          </div>
          <button onClick={onClose} className="p-1.5 rounded-lg text-slate-500 hover:bg-slate-100" aria-label="Close">
            <X className="h-5 w-5" />
          </button>
        </div>

        <div className="px-4 py-3 border-b border-slate-100 bg-slate-50">
          <label htmlFor="bill-delivery" className="block text-[11px] font-semibold text-slate-600 mb-1">
            Delivery charge (optional, added to the total)
          </label>
          <div className="flex items-center gap-2">
            <span className="text-sm text-slate-500">Rs</span>
            <input
              id="bill-delivery"
              ref={input}
              type="number"
              min="0"
              step="1"
              inputMode="numeric"
              placeholder="0"
              value={delivery}
              onChange={(e) => setDelivery(e.target.value)}
              className={`w-36 bg-white border rounded-lg px-3 py-1.5 text-sm font-mono focus:outline-none ${
                invalid ? 'border-rose-400' : 'border-slate-300 focus:border-teal-600'
              }`}
            />
            {delivery && (
              <button type="button" onClick={() => setDelivery('')} className="text-xs font-semibold text-slate-500 hover:text-rose-600">
                Remove
              </button>
            )}
          </div>
        </div>

        <div className="flex-1 overflow-y-auto bg-slate-100 p-3 min-h-[240px] flex items-start justify-center">
          {failed ? (
            <div className="text-sm text-rose-600 py-10">Could not draw the bill. Check the order and try again.</div>
          ) : (
            <div className="relative w-full">
              {loading && (
                <div className="absolute inset-0 flex items-center justify-center">
                  <Loader2 className="h-6 w-6 animate-spin text-slate-400" />
                </div>
              )}
              {/* eslint-disable-next-line @next/next/no-img-element */}
              <img
                key={previewUrl}
                src={previewUrl}
                alt={`Bill for order ${orderNo ?? ''}`}
                onLoad={() => setLoading(false)}
                onError={() => {
                  setLoading(false)
                  setFailed(true)
                }}
                className={`w-full rounded-lg shadow-sm bg-white transition-opacity ${loading ? 'opacity-30' : 'opacity-100'}`}
              />
            </div>
          )}
        </div>

        {sent && (
          <div
            className={`flex items-center gap-1.5 px-4 py-2 border-t text-xs font-semibold ${
              sent.status === 'SENT'
                ? 'bg-emerald-50 border-emerald-200 text-emerald-700'
                : sent.status === 'FAILED'
                  ? 'bg-rose-50 border-rose-200 text-rose-700'
                  : 'bg-slate-50 border-slate-200 text-slate-600'
            }`}
          >
            {sent.status === 'SENT' ? (
              <>
                <CheckCircle2 className="h-4 w-4" />
                Bill sent on WhatsApp
                {sent.sentAt &&
                  ` · ${new Date(sent.sentAt).toLocaleString('en-GB', { day: 'numeric', month: 'short', hour: 'numeric', minute: '2-digit', hour12: true })}`}
              </>
            ) : sent.status === 'FAILED' ? (
              <>
                <AlertTriangle className="h-4 w-4 shrink-0" />
                <span className="truncate" title={sent.error || ''}>
                  Bill not sent{sent.error ? `: ${sent.error}` : ''}
                </span>
              </>
            ) : (
              <>
                <Loader2 className="h-4 w-4 animate-spin" />
                Sending bill on WhatsApp… (a few seconds to a minute)
              </>
            )}
          </div>
        )}

        <div className="flex flex-wrap gap-2 px-4 py-3 border-t border-slate-200 bg-white">
          <button type="button" onClick={download} disabled={!!busy || invalid} className={`${btn} border border-slate-300 bg-white text-slate-800 hover:bg-slate-50`}>
            {busy === 'download' ? <Loader2 className="h-4 w-4 animate-spin" /> : <Download className="h-4 w-4" />} Download
          </button>
          <button type="button" onClick={share} disabled={!!busy || invalid} className={`${btn} border border-teal-600 bg-teal-50 text-teal-800 hover:bg-teal-100`}>
            {busy === 'share' ? <Loader2 className="h-4 w-4 animate-spin" /> : <Share2 className="h-4 w-4" />} Share
          </button>
          {!blocked && (
            <button
              type="button"
              onClick={sendWhatsApp}
              disabled={!!busy || invalid || !customerPhone}
              title={customerPhone ? 'Send from the linked business WhatsApp' : 'This order has no customer phone'}
              className={`${btn} bg-[#25d366] text-white hover:bg-[#1ebe5b]`}
            >
              {busy === 'send' ? <Loader2 className="h-4 w-4 animate-spin" /> : <Send className="h-4 w-4" />} Send on WhatsApp
            </button>
          )}
          {blocked && (
            <p className="w-full text-[11px] text-slate-500">
              {blocked} This bill has no WhatsApp number on it and cannot be sent on WhatsApp.
            </p>
          )}
        </div>
      </div>
    </div>,
    document.body,
  )
}

// "Bill" button that opens the bill window
export function BillButton({
  sale,
  variant = 'icon',
}: {
  sale: { id: string; orderNo?: number | null; customerName?: string | null; customerPhone?: string | null }
  variant?: 'icon' | 'full'
}) {
  const [open, setOpen] = useState(false)
  return (
    <>
      <button
        type="button"
        onClick={(e) => {
          e.stopPropagation()
          setOpen(true)
        }}
        title="Bill: download, share or send on WhatsApp"
        aria-label="Bill"
        className={
          variant === 'icon'
            ? 'p-1.5 rounded-lg bg-teal-50 hover:bg-teal-100 border border-teal-200/70 text-teal-700 transition'
            : 'px-3 py-1.5 rounded-lg bg-teal-50 border border-teal-200 text-teal-700 text-xs font-semibold hover:bg-teal-100 flex items-center justify-center gap-1 transition'
        }
      >
        <ReceiptText className={variant === 'icon' ? 'h-3.5 w-3.5' : 'h-3.5 w-3.5'} />
        {variant === 'full' && 'Bill'}
      </button>
      {open && (
        <BillDialog
          saleId={sale.id}
          orderNo={sale.orderNo}
          customerName={sale.customerName}
          customerPhone={sale.customerPhone}
          onClose={() => setOpen(false)}
        />
      )}
    </>
  )
}
