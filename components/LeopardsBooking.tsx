'use client'

import React, { useEffect, useMemo, useState } from 'react'
import { createPortal } from 'react-dom'
import { X, Loader2, Truck, Printer, Ban, Search } from 'lucide-react'
import { toast } from 'sonner'

// Book an order with Leopards from the app (pre-filled from the order), print its slip, or cancel it.

interface City {
  id: number
  name: string
}
interface OrderInfo {
  id: string // lead row id
  orderNo?: number | null
  customerName: string
  customerPhone?: string | null
  address: string
  city: string
  total: number // what the customer pays (COD)
  items: number // total quantity
}

const DEFAULT_INSTRUCTIONS = 'Please call customer before delivery.'
const rs = (n: number) => `Rs. ${Math.round(n).toLocaleString('en-PK')}`
const input = 'w-full rounded-lg border border-slate-300 bg-white px-3 py-2 text-sm focus:outline-none focus:border-amber-500'
const label = 'block text-[11px] font-semibold text-slate-600 mb-1'

export function BookLeopardsDialog({ order, onClose, onBooked }: { order: OrderInfo; onClose: () => void; onBooked: (cn: string) => void }) {
  const [cities, setCities] = useState<City[]>([])
  const [cityId, setCityId] = useState<number | ''>('')
  const [cityQuery, setCityQuery] = useState('')
  const [f, setF] = useState({
    name: order.customerName,
    phone: order.customerPhone || '',
    phone2: '',
    address: order.address,
    cod: String(Math.round(order.total)),
    weight: '450',
    pieces: String(Math.max(1, order.items)),
    instructions: DEFAULT_INSTRUCTIONS,
  })
  const [busy, setBusy] = useState(false)
  const [mounted, setMounted] = useState(false)

  useEffect(() => {
    setMounted(true)
    fetch(`/api/leopards/cities?city=${encodeURIComponent(order.city)}`)
      .then((r) => r.json())
      .then((d) => {
        if (d.error) throw new Error(d.error)
        setCities(d.cities)
        if (d.match) setCityId(d.match.id)
      })
      .catch((e) => toast.error(e.message))
  }, [order.city])

  const shown = useMemo(() => {
    const q = cityQuery.trim().toLowerCase()
    return (q ? cities.filter((c) => c.name.toLowerCase().includes(q)) : cities).slice(0, 200)
  }, [cities, cityQuery])
  const city = cities.find((c) => c.id === cityId)

  const book = async (e: React.FormEvent) => {
    e.preventDefault()
    if (!city) return toast.error('Pick the Leopards destination city')
    if (!confirm(`Book with Leopards now?\n\n${f.name} · ${city.name}\nCOD ${rs(parseFloat(f.cod) || 0)} · ${f.weight} g × ${f.pieces}\n\nThis creates a real Leopards booking.`)) return
    setBusy(true)
    try {
      const res = await fetch(`/api/sales/${order.id}/leopards`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          cityId: city.id,
          name: f.name,
          phone: f.phone,
          phone2: f.phone2,
          address: f.address,
          codAmount: f.cod,
          weightGrams: f.weight,
          pieces: f.pieces,
          instructions: f.instructions,
        }),
      })
      const d = await res.json()
      if (!res.ok) throw new Error(d.error || 'Booking failed')
      toast.success(`Booked with Leopards: ${d.trackingNumber}`)
      onBooked(d.trackingNumber)
    } catch (err: any) {
      toast.error(err.message)
    } finally {
      setBusy(false)
    }
  }

  if (!mounted) return null
  return createPortal(
    <div className="fixed inset-0 z-[110] flex items-end sm:items-center justify-center bg-slate-900/40 sm:p-4" onClick={onClose}>
      <div onClick={(e) => e.stopPropagation()} className="w-full sm:max-w-xl max-h-[94vh] overflow-y-auto rounded-t-2xl sm:rounded-2xl bg-white shadow-xl">
        <div className="sticky top-0 z-10 flex items-center gap-2 border-b border-slate-100 bg-white px-4 py-3">
          <Truck className="h-4 w-4 text-amber-600" />
          <h2 className="text-sm font-bold text-slate-900">Book Leopards{order.orderNo ? ` · Order #${order.orderNo}` : ''}</h2>
          <button onClick={onClose} className="ml-auto rounded-lg p-1.5 text-slate-400 hover:bg-slate-100" aria-label="Close">
            <X className="h-4 w-4" />
          </button>
        </div>
        <form onSubmit={book} className="space-y-3 p-4">
          <p className="text-[11px] text-slate-500">
            Your shipper details (FANCY STORE, phone, pickup / return address, Lahore) come from your Leopards account automatically.
          </p>
          <div className="grid sm:grid-cols-2 gap-2">
            <div>
              <label className={label}>Customer name</label>
              <input value={f.name} onChange={(e) => setF({ ...f, name: e.target.value })} className={input} />
            </div>
            <div>
              <label className={label}>Phone</label>
              <input value={f.phone} onChange={(e) => setF({ ...f, phone: e.target.value })} className={input} />
            </div>
            <div className="sm:col-span-2">
              <label className={label}>Address</label>
              <textarea value={f.address} onChange={(e) => setF({ ...f, address: e.target.value })} rows={2} className={input} />
            </div>
          </div>

          <div>
            <label className={label}>
              Leopards city * {order.city && <span className="font-normal text-slate-400">(order says “{order.city}”)</span>}
            </label>
            <div className="relative mb-1">
              <Search className="absolute left-2.5 top-2.5 h-3.5 w-3.5 text-slate-400" />
              <input value={cityQuery} onChange={(e) => setCityQuery(e.target.value)} placeholder="Search city…" className={`${input} pl-8 py-1.5 text-xs`} />
            </div>
            <select value={cityId} onChange={(e) => setCityId(e.target.value ? Number(e.target.value) : '')} size={5} className={`${input} text-xs`}>
              {city && !shown.some((c) => c.id === city.id) && <option value={city.id}>{city.name} (selected)</option>}
              {shown.map((c) => (
                <option key={c.id} value={c.id}>
                  {c.name}
                </option>
              ))}
            </select>
            {city ? (
              <p className="mt-1 text-[11px] font-semibold text-emerald-700">Selected: {city.name}</p>
            ) : (
              <p className="mt-1 text-[11px] text-amber-700">{cities.length ? 'City not matched automatically — pick it from the list.' : 'Loading cities…'}</p>
            )}
          </div>

          <div className="grid grid-cols-3 gap-2">
            <div>
              <label className={label}>Cash to collect (COD)</label>
              <input type="number" min="0" value={f.cod} onChange={(e) => setF({ ...f, cod: e.target.value })} className={`${input} font-mono`} />
              <p className="mt-0.5 text-[10px] text-slate-400">order total {rs(order.total)} · 0 if paid</p>
            </div>
            <div>
              <label className={label}>Weight (grams)</label>
              <input type="number" min="1" value={f.weight} onChange={(e) => setF({ ...f, weight: e.target.value })} className={`${input} font-mono`} />
            </div>
            <div>
              <label className={label}>Pieces</label>
              <input type="number" min="1" value={f.pieces} onChange={(e) => setF({ ...f, pieces: e.target.value })} className={`${input} font-mono`} />
            </div>
          </div>
          <div>
            <label className={label}>Special instruction</label>
            <input value={f.instructions} onChange={(e) => setF({ ...f, instructions: e.target.value })} className={input} />
          </div>
          {Math.abs((parseFloat(f.cod) || 0) - order.total) >= 1 && (parseFloat(f.cod) || 0) > 0 && (
            <p className="rounded-lg border border-amber-200 bg-amber-50 px-3 py-2 text-xs text-amber-800">
              COD {rs(parseFloat(f.cod) || 0)} is different from the order total {rs(order.total)}. Is that right?
            </p>
          )}
          <div className="flex justify-end gap-2">
            <button type="button" onClick={onClose} className="rounded-lg border border-slate-200 px-3 py-2 text-xs font-semibold text-slate-600">
              Cancel
            </button>
            <button type="submit" disabled={busy || !city} className="flex items-center gap-1.5 rounded-lg bg-amber-500 px-4 py-2 text-xs font-bold text-amber-950 hover:bg-amber-600 disabled:opacity-50">
              {busy ? <Loader2 className="h-4 w-4 animate-spin" /> : <Truck className="h-4 w-4" />} Book with Leopards
            </button>
          </div>
        </form>
      </div>
    </div>,
    document.body
  )
}

// Section for the order drawer: Book button, or (booked from the app) Print slip + Cancel booking
export function LeopardsBookingSection({
  order,
  trackingNumber,
  bookedAt,
  hasSlip,
  status,
  onChanged,
}: {
  order: OrderInfo
  trackingNumber?: string | null
  bookedAt?: string | null
  hasSlip?: boolean
  status: string
  onChanged: () => void
}) {
  const [open, setOpen] = useState(false)
  const [cancelling, setCancelling] = useState(false)
  const canBook = !trackingNumber && (status === 'PACKING' || status === 'DISPATCHED')

  const cancel = async () => {
    if (!confirm(`Cancel the Leopards booking ${trackingNumber}?\n\nOnly works before Leopards picks the parcel up.`)) return
    setCancelling(true)
    try {
      const res = await fetch(`/api/sales/${order.id}/leopards`, { method: 'DELETE' })
      const d = await res.json()
      if (!res.ok) throw new Error(d.error || 'Could not cancel')
      toast.success(`Leopards booking ${d.cancelled} cancelled`)
      onChanged()
    } catch (e: any) {
      toast.error(e.message)
    } finally {
      setCancelling(false)
    }
  }

  if (!canBook && !bookedAt) return null
  return (
    <div className="rounded-xl border border-amber-200 bg-amber-50/50 p-3 space-y-2">
      {canBook ? (
        <>
          <p className="text-xs text-slate-600">Not booked with a courier yet.</p>
          <button onClick={() => setOpen(true)} className="flex w-full items-center justify-center gap-1.5 rounded-lg bg-amber-500 px-3 py-2 text-xs font-bold text-amber-950 hover:bg-amber-600">
            <Truck className="h-4 w-4" /> Book Leopards
          </button>
        </>
      ) : (
        <>
          <p className="text-xs text-slate-700">
            Booked from the app: <b className="font-mono">{trackingNumber}</b>
            {bookedAt ? ` · ${new Date(bookedAt).toLocaleString('en-GB', { day: 'numeric', month: 'short', hour: '2-digit', minute: '2-digit' })}` : ''}
          </p>
          <div className="flex gap-2">
            {hasSlip && (
              <a
                href={`/api/sales/${order.id}/leopards/slip`}
                target="_blank"
                rel="noopener"
                className="flex flex-1 items-center justify-center gap-1.5 rounded-lg bg-slate-900 px-3 py-2 text-xs font-bold text-white hover:bg-slate-700"
              >
                <Printer className="h-4 w-4" /> Print slip
              </a>
            )}
            {(status === 'PACKING' || status === 'DISPATCHED') && (
              <button
                onClick={cancel}
                disabled={cancelling}
                className="flex flex-1 items-center justify-center gap-1.5 rounded-lg border border-rose-200 bg-white px-3 py-2 text-xs font-semibold text-rose-600 hover:bg-rose-50 disabled:opacity-50"
              >
                {cancelling ? <Loader2 className="h-4 w-4 animate-spin" /> : <Ban className="h-4 w-4" />} Cancel booking
              </button>
            )}
          </div>
        </>
      )}
      {open && (
        <BookLeopardsDialog
          order={order}
          onClose={() => setOpen(false)}
          onBooked={() => {
            setOpen(false)
            onChanged()
          }}
        />
      )}
    </div>
  )
}
