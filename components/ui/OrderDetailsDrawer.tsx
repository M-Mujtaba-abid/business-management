'use client'

import React, { useState, useEffect, useMemo } from 'react'
import {
  X, MapPin, Package, Trash2, Camera, CheckCircle2, RotateCcw, XCircle, Wallet, Banknote, Pencil, Truck, Hash, Save, Recycle,
} from 'lucide-react'
import { toast } from 'sonner'
import StatusBadge from './StatusBadge'
import CopyRef from './CopyRef'
import { Sale } from '../OrderList'
import { groupSales } from '@/lib/parcels'
import { formatDateTime } from '@/lib/format'
import PhotoPicker from './PhotoPicker'
import { OrderPhoto, discardOrderPhoto } from '@/lib/photoUpload'

export type { Sale }

type OrderStatus = Sale['status']
type PayStatus = 'RECEIVED' | 'NOT_RECEIVED'

interface OrderDetailsDrawerProps {
  // The order's products: one for a single-product order, several for a parcel
  items: Sale[]
  isOpen: boolean
  onClose: () => void
  onDeleteSale: (id: string) => void
  onEditOrder: (items: Sale[]) => void
  // Called after "Save changes" stored everything (refresh lists)
  onSaved: () => void
}

const formatPKR = (amt: number) => `Rs. ${Math.round(amt).toLocaleString()}`

const STATUS_OPTIONS: { value: OrderStatus; label: string; icon: typeof Truck; active: string }[] = [
  { value: 'DISPATCHED', label: 'Dispatched', icon: Truck, active: 'bg-blue-500 text-white border-blue-500' },
  { value: 'DELIVERED', label: 'Delivered', icon: CheckCircle2, active: 'bg-emerald-500 text-white border-emerald-500' },
  { value: 'RETURNED', label: 'Returned', icon: RotateCcw, active: 'bg-rose-500 text-white border-rose-500' },
  { value: 'CANCELLED', label: 'Cancelled', icon: XCircle, active: 'bg-slate-600 text-white border-slate-600' },
]

const segment = (active: boolean, activeClass: string) =>
  `flex-1 px-2 py-2 rounded-lg text-xs font-semibold border transition flex items-center justify-center gap-1.5 ${
    active ? activeClass : 'bg-white text-slate-600 border-slate-200 hover:border-slate-300'
  }`

// Order details. Status, payment and supplier changes are staged here and saved together with "Save changes".
export default function OrderDetailsDrawer({ items, isOpen, onClose, onDeleteSale, onEditOrder, onSaved }: OrderDetailsDrawerProps) {
  const [people, setPeople] = useState<{ id: string; name: string }[]>([])
  const group = useMemo(() => (items.length ? groupSales(items)[0] : null), [items])

  // ── staged (unsaved) values ──
  const [status, setStatus] = useState<OrderStatus>('DISPATCHED')
  const [returnLoss, setReturnLoss] = useState('')
  const [coverReturned, setCoverReturned] = useState(true)
  const [payStatus, setPayStatus] = useState<PayStatus>('NOT_RECEIVED')
  const [payAmount, setPayAmount] = useState('')
  const [receivedById, setReceivedById] = useState('')
  const [supplierPaid, setSupplierPaid] = useState<Record<string, boolean>>({})
  const [isSaving, setIsSaving] = useState(false)
  // order photos: the saved ones, and the list being edited here
  const [savedPhotos, setSavedPhotos] = useState<OrderPhoto[]>([])
  const [photos, setPhotos] = useState<OrderPhoto[]>([])
  const [photosUploading, setPhotosUploading] = useState(false)

  useEffect(() => {
    if (!isOpen) return
    fetch('/api/people')
      .then((r) => r.json())
      .then((data) => {
        if (Array.isArray(data)) setPeople(data)
      })
      .catch(console.error)
  }, [isOpen])

  // Start from the saved values whenever another order is opened (or the saved data refreshes)
  const initial = useMemo(() => {
    if (!group) return null
    const lead = group.lead
    return {
      status: lead.status,
      payStatus: (lead.paymentStatus === 'RECEIVED' ? 'RECEIVED' : 'NOT_RECEIVED') as PayStatus,
      payAmount: String(Math.round(group.payout * 100) / 100),
      receivedById: lead.receivedBy?.id || '',
      supplierPaid: Object.fromEntries(group.items.map((i) => [i.id, i.supplierPaymentStatus === 'PAID'])),
    }
  }, [group])

  useEffect(() => {
    if (!initial || !group) return
    setStatus(initial.status)
    setPayStatus(initial.payStatus)
    setPayAmount(initial.payAmount)
    setReceivedById(initial.receivedById)
    setSupplierPaid(initial.supplierPaid)
    setCoverReturned(true)
    setReturnLoss(String(Math.round((group.deliveryCharge + group.petrolCost) * 100) / 100))
  }, [initial, group])

  // Load the order's photos when it opens (or when its data refreshes)
  const photoOrderNo = isOpen ? group?.lead.orderNo ?? null : null
  useEffect(() => {
    setSavedPhotos([])
    setPhotos([])
    if (!photoOrderNo) return
    let cancelled = false
    fetch(`/api/orders/${photoOrderNo}/images`)
      .then((r) => r.json())
      .then((data) => {
        if (cancelled || !Array.isArray(data)) return
        const list = data.map((p) => ({ id: p.id, url: p.url, publicId: p.publicId, width: p.width, height: p.height }))
        setSavedPhotos(list)
        setPhotos(list)
      })
      .catch(console.error)
    return () => {
      cancelled = true
    }
  }, [photoOrderNo, items])

  if (!isOpen || !group || !initial) return null

  const lead = group.lead
  const isParcel = group.items.length > 1
  const tracksPayment = lead.paymentStatus !== 'NOT_APPLICABLE'
  const amountNum = parseFloat(payAmount)
  const amountValid = !isNaN(amountNum) && amountNum >= 0
  const cut = amountValid ? group.saleTotal - amountNum : 0
  const returning = status === 'RETURNED' && initial.status !== 'RETURNED'

  // What will change on save
  const supplierChanges = group.items.filter(
    (i) => i.supplierPaymentStatus !== 'NOT_APPLICABLE' && supplierPaid[i.id] !== initial.supplierPaid[i.id]
  )
  const photosAdded = photos.filter((p) => !p.id)
  const photosRemoved = savedPhotos.filter((sp) => !photos.some((p) => p.id === sp.id))

  const changes = {
    status: status !== initial.status,
    payStatus: tracksPayment && payStatus !== initial.payStatus,
    payAmount: tracksPayment && amountValid && Math.abs(amountNum - parseFloat(initial.payAmount)) >= 0.005,
    person: tracksPayment && receivedById !== initial.receivedById,
    supplier: supplierChanges.length > 0,
  }
  const changeCount =
    Number(changes.status) + Number(changes.payStatus || changes.payAmount) + Number(changes.person) + supplierChanges.length +
    photosAdded.length + photosRemoved.length
  const isDirty = changeCount > 0

  const handleClose = () => {
    if (isDirty && !confirm('You have unsaved changes. Close without saving?')) return
    // photos uploaded here but not saved: remove them from storage
    photosAdded.forEach((p) => discardOrderPhoto(p.publicId))
    onClose()
  }

  const toggleCover = (back: boolean) => {
    setCoverReturned(back)
    // suggested loss: DC + petrol, plus the covers' cost if they did not come back
    const base = group.deliveryCharge + group.petrolCost
    setReturnLoss(String(Math.round((back ? base : base + group.costTotal) * 100) / 100))
  }

  const call = async (url: string, method: string, body: unknown) => {
    const res = await fetch(url, { method, headers: { 'Content-Type': 'application/json' }, body: JSON.stringify(body) })
    if (!res.ok) {
      const data = await res.json().catch(() => ({}))
      throw new Error(data.error || 'Failed to save')
    }
  }

  // Apply everything in a safe order: status first (sets profit), then payment (re-calcs profit), then people / suppliers
  const handleSave = async () => {
    if (!isDirty) return onClose()
    if (tracksPayment && changes.payAmount && !amountValid) {
      toast.error('Enter a valid received amount')
      return
    }
    setIsSaving(true)
    try {
      if (changes.status) {
        const loss = parseFloat(returnLoss)
        await call(`/api/sales/${lead.id}`, 'PATCH', {
          status,
          ...(returning ? { returnLoss: isNaN(loss) ? 0 : Math.max(0, loss), coverReturned } : {}),
        })
      }
      if (changes.payStatus || changes.payAmount) {
        await call(`/api/sales/${lead.id}/payment`, 'PATCH', {
          ...(changes.payAmount ? { receivedAmount: amountNum } : {}),
          ...(changes.payStatus ? { status: payStatus } : {}),
        })
      }
      if (changes.person) {
        await call('/api/sales/customer-payment', 'PATCH', { saleIds: group.ids, receivedById: receivedById || null })
      }
      const toPaid = supplierChanges.filter((i) => supplierPaid[i.id]).map((i) => i.id)
      const toPending = supplierChanges.filter((i) => !supplierPaid[i.id]).map((i) => i.id)
      if (toPaid.length) await call('/api/sales/supplier-payment', 'PATCH', { saleIds: toPaid, status: 'PAID' })
      if (toPending.length) await call('/api/sales/supplier-payment', 'PATCH', { saleIds: toPending, status: 'PENDING' })

      if (lead.orderNo) {
        for (const p of photosRemoved) await call(`/api/orders/${lead.orderNo}/images/${p.id}`, 'DELETE', {})
        for (const p of photosAdded) await call(`/api/orders/${lead.orderNo}/images`, 'POST', p)
      }

      toast.success('Changes saved')
      onSaved()
      onClose()
    } catch (err: any) {
      toast.error(err.message || 'Failed to save changes')
      onSaved() // some steps may have saved: show the latest data
    } finally {
      setIsSaving(false)
    }
  }

  const profitTone = lead.status === 'DELIVERED' ? 'text-emerald-600' : lead.status === 'RETURNED' ? 'text-rose-600' : 'text-slate-500'

  return (
    <div className="fixed inset-0 z-50 overflow-hidden bg-slate-900/30 backdrop-blur-sm animate-in fade-in">
      <div className="absolute inset-0" onClick={handleClose} />

      <aside className="absolute inset-y-0 right-0 w-full sm:w-[640px] lg:w-[720px] max-w-full flex">
        <div className="w-full bg-slate-50 sm:border-l border-slate-200 text-slate-900 shadow-2xl flex flex-col">

          {/* ── Header ── */}
          <div className="bg-white border-b border-slate-200 px-4 sm:px-6 pt-4 pb-3 space-y-3">
            <div className="flex items-start justify-between gap-3">
              <div className="min-w-0">
                <div className="flex items-center gap-2 flex-wrap">
                  {lead.orderNo && (
                    <span className="inline-flex items-center gap-0.5 text-xs font-bold text-slate-500 font-mono">
                      <Hash className="h-3.5 w-3.5" />{lead.orderNo}
                    </span>
                  )}
                  <StatusBadge status={lead.status} />
                  {isParcel && (
                    <span className="px-1.5 py-px rounded bg-slate-900 text-white text-[10px] font-bold">{group.items.length} items</span>
                  )}
                  {lead.orderSource?.name && (
                    <span className="px-1.5 py-px rounded bg-violet-50 text-violet-700 border border-violet-100 text-[10px] font-semibold">
                      {lead.orderSource.name}
                    </span>
                  )}
                </div>
                <h2 className="text-lg sm:text-xl font-bold text-slate-900 mt-1 break-words">
                  {isParcel ? group.items.map((i) => i.productName).join(', ') : lead.productName}
                </h2>
                <p className="text-xs text-slate-500">Added {formatDateTime(lead.createdAt)}</p>
              </div>
              <div className="flex items-center gap-1 shrink-0">
                <button
                  onClick={() => {
                    if (isDirty && !confirm('Unsaved status changes will be lost. Open the editor?')) return
                    onEditOrder(group.items)
                    onClose()
                  }}
                  className="px-3 py-1.5 rounded-lg bg-blue-50 border border-blue-200 text-blue-700 text-xs font-semibold hover:bg-blue-100 flex items-center gap-1 transition"
                >
                  <Pencil className="h-3.5 w-3.5" /> Edit
                </button>
                <button onClick={handleClose} className="p-1.5 rounded-lg text-slate-500 hover:text-slate-900 hover:bg-slate-100 transition">
                  <X className="h-5 w-5" />
                </button>
              </div>
            </div>

            {/* Money at a glance */}
            <div className="grid grid-cols-3 gap-2">
              <div className="rounded-xl bg-slate-50 border border-slate-200 px-3 py-2">
                <div className="text-[11px] text-slate-500">Sale</div>
                <div className="text-sm sm:text-base font-bold font-mono text-slate-900">{formatPKR(group.saleTotal)}</div>
              </div>
              <div className="rounded-xl bg-slate-50 border border-slate-200 px-3 py-2">
                <div className="text-[11px] text-slate-500">Cost + DC/Petrol/GST</div>
                <div className="text-sm sm:text-base font-bold font-mono text-slate-700">
                  {formatPKR(group.costTotal + group.deliveryCharge + group.petrolCost + group.gstAmount)}
                </div>
              </div>
              <div className="rounded-xl bg-slate-50 border border-slate-200 px-3 py-2">
                <div className="text-[11px] text-slate-500">Profit</div>
                <div className={`text-sm sm:text-base font-bold font-mono ${profitTone}`}>
                  {lead.status === 'DELIVERED' || lead.status === 'RETURNED' ? formatPKR(group.profit) : 'On delivery'}
                </div>
              </div>
            </div>
          </div>

          {/* ── Body ── */}
          <div className="flex-1 overflow-y-auto px-4 sm:px-6 py-4 space-y-4">

            {/* Order status */}
            <section className="bg-white border border-slate-200 rounded-2xl p-4 space-y-3">
              <h3 className="text-xs font-semibold text-slate-500 uppercase tracking-wider flex items-center gap-1.5">
                <Truck className="h-3.5 w-3.5 text-blue-600" /> Order status
                {changes.status && <span className="ml-auto text-[10px] normal-case font-semibold text-amber-600">changed</span>}
              </h3>
              <div className="grid grid-cols-2 sm:grid-cols-4 gap-2">
                {STATUS_OPTIONS.map((o) => {
                  const Icon = o.icon
                  return (
                    <button key={o.value} type="button" onClick={() => setStatus(o.value)} className={segment(status === o.value, o.active)}>
                      <Icon className="h-3.5 w-3.5" /> {o.label}
                    </button>
                  )
                })}
              </div>

              {returning && (
                <div className="rounded-xl bg-rose-50 border border-rose-200 p-3 space-y-2.5">
                  <label className="flex items-center gap-2 text-xs font-semibold text-slate-700 cursor-pointer">
                    <input
                      type="checkbox"
                      checked={coverReturned}
                      onChange={(e) => toggleCover(e.target.checked)}
                      className="h-4 w-4 accent-emerald-500"
                    />
                    <Recycle className="h-3.5 w-3.5 text-emerald-600" />
                    {isParcel ? 'Covers came back (go to Returned stock)' : 'Cover came back (goes to Returned stock)'}
                  </label>
                  <div className="flex items-center gap-2">
                    <span className="text-xs text-slate-600 shrink-0">Loss (Rs)</span>
                    <input
                      type="number"
                      min="0"
                      step="0.01"
                      value={returnLoss}
                      onChange={(e) => setReturnLoss(e.target.value)}
                      className="w-full bg-white border border-slate-300 rounded-lg px-3 py-1.5 text-sm font-mono text-slate-900 focus:outline-none focus:border-rose-500"
                    />
                  </div>
                  <p className="text-[11px] text-slate-500">Prefilled with DC + petrol{coverReturned ? '' : ' + cover cost'}. Subtracted from net profit.</p>
                </div>
              )}
              {status === 'RETURNED' && !returning && lead.status === 'RETURNED' && (
                <p className="text-[11px] text-rose-600">Return loss: {formatPKR(-group.profit)}</p>
              )}
            </section>

            {/* Payment */}
            {tracksPayment && (
              <section className="bg-white border border-slate-200 rounded-2xl p-4 space-y-3">
                <h3 className="text-xs font-semibold text-slate-500 uppercase tracking-wider flex items-center gap-1.5">
                  <Banknote className="h-3.5 w-3.5 text-emerald-600" /> Payment
                  <span className="normal-case font-normal text-slate-400">· from {lead.paymentSource?.name || 'no source set'}</span>
                  {(changes.payStatus || changes.payAmount || changes.person) && (
                    <span className="ml-auto text-[10px] normal-case font-semibold text-amber-600">changed</span>
                  )}
                </h3>
                <div className="grid grid-cols-2 gap-2">
                  <button type="button" onClick={() => setPayStatus('NOT_RECEIVED')} className={segment(payStatus === 'NOT_RECEIVED', 'bg-rose-500 text-white border-rose-500')}>
                    Not received
                  </button>
                  <button type="button" onClick={() => setPayStatus('RECEIVED')} className={segment(payStatus === 'RECEIVED', 'bg-emerald-500 text-white border-emerald-500')}>
                    <CheckCircle2 className="h-3.5 w-3.5" /> Received
                  </button>
                </div>

                <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
                  <label className="block">
                    <span className="block text-[11px] font-semibold text-slate-600 mb-1">
                      {payStatus === 'RECEIVED' ? 'Amount received (Rs)' : 'Expected amount (Rs)'}
                    </span>
                    <input
                      type="number"
                      min="0"
                      step="0.01"
                      value={payAmount}
                      onChange={(e) => setPayAmount(e.target.value)}
                      className="w-full bg-white border border-slate-300 rounded-lg px-3 py-2 text-sm font-mono text-slate-900 focus:outline-none focus:border-emerald-500"
                    />
                    {amountValid && Math.abs(cut) >= 0.5 && (
                      <span className={`block text-[11px] mt-1 ${cut > 0 ? 'text-rose-600' : 'text-emerald-600'}`}>
                        {cut > 0 ? `${formatPKR(cut)} cut (tax / fees)` : `${formatPKR(-cut)} extra`} vs sale {formatPKR(group.saleTotal)}
                      </span>
                    )}
                  </label>
                  <label className="block">
                    <span className="block text-[11px] font-semibold text-slate-600 mb-1">Money goes to</span>
                    <select
                      value={receivedById}
                      onChange={(e) => setReceivedById(e.target.value)}
                      className="w-full bg-white border border-slate-300 rounded-lg px-3 py-2 text-sm text-slate-800 focus:outline-none focus:border-emerald-500"
                    >
                      <option value="">Not set</option>
                      {people.map((p) => (
                        <option key={p.id} value={p.id}>{p.name}</option>
                      ))}
                    </select>
                  </label>
                </div>
                {lead.paymentStatus === 'RECEIVED' && lead.paymentReceivedAt && (
                  <p className="text-[11px] text-slate-500">Received on {new Date(lead.paymentReceivedAt).toLocaleDateString()}</p>
                )}
              </section>
            )}

            {/* Products + supplier payments */}
            <section className="bg-white border border-slate-200 rounded-2xl p-4 space-y-3">
              <h3 className="text-xs font-semibold text-slate-500 uppercase tracking-wider flex items-center gap-1.5">
                <Package className="h-3.5 w-3.5 text-blue-600" /> {isParcel ? 'Products & supplier payments' : 'Product & supplier payment'}
                {changes.supplier && <span className="ml-auto text-[10px] normal-case font-semibold text-amber-600">changed</span>}
              </h3>
              <div className="space-y-2">
                {group.items.map((item) => {
                  const tracked = item.supplierPaymentStatus !== 'NOT_APPLICABLE'
                  const paid = supplierPaid[item.id]
                  return (
                    <div key={item.id} className="rounded-xl border border-slate-200 p-3 space-y-2">
                      <div className="flex items-start justify-between gap-3">
                        <div className="min-w-0">
                          <div className="font-semibold text-sm text-slate-900 break-words">{item.productName}</div>
                          <div className="text-[11px] text-slate-500">
                            {item.category?.name && <span className="text-sky-600">{item.category.name} · </span>}
                            {item.quantity} × {formatPKR(item.soldPrice)} · cost {formatPKR(item.costPrice * item.quantity)}
                          </div>
                        </div>
                        <div className="text-sm font-bold font-mono text-slate-900 shrink-0">{formatPKR(item.soldPrice * item.quantity)}</div>
                      </div>
                      <div className="flex items-center justify-between gap-2">
                        <span className="text-xs text-slate-600 flex items-center gap-1 min-w-0">
                          <Wallet className="h-3.5 w-3.5 text-amber-600 shrink-0" />
                          <span className="truncate">{item.supplier?.name || (item.returnedItemId ? '♻ Returned stock' : 'No supplier')}</span>
                        </span>
                        {tracked ? (
                          <div className="flex gap-1 shrink-0">
                            <button
                              type="button"
                              onClick={() => setSupplierPaid((p) => ({ ...p, [item.id]: false }))}
                              className={`px-2.5 py-1 rounded-lg text-[11px] font-bold border ${!paid ? 'bg-amber-500 text-white border-amber-500' : 'bg-white text-slate-500 border-slate-200'}`}
                            >
                              Pending
                            </button>
                            <button
                              type="button"
                              onClick={() => setSupplierPaid((p) => ({ ...p, [item.id]: true }))}
                              className={`px-2.5 py-1 rounded-lg text-[11px] font-bold border ${paid ? 'bg-emerald-500 text-white border-emerald-500' : 'bg-white text-slate-500 border-slate-200'}`}
                            >
                              Paid
                            </button>
                          </div>
                        ) : (
                          <span className="text-[11px] text-slate-400">no supplier payment</span>
                        )}
                      </div>
                    </div>
                  )
                })}
              </div>
              {isParcel && group.supplierTracked > 1 && (
                <button
                  type="button"
                  onClick={() =>
                    setSupplierPaid((p) => {
                      const next = { ...p }
                      group.items.forEach((i) => {
                        if (i.supplierPaymentStatus !== 'NOT_APPLICABLE') next[i.id] = true
                      })
                      return next
                    })
                  }
                  className="text-xs font-semibold text-emerald-700 hover:underline"
                >
                  Mark all suppliers paid
                </button>
              )}
            </section>

            {/* Photos */}
            {lead.orderNo && (
              <section className="bg-white border border-slate-200 rounded-2xl p-4 space-y-3">
                <h3 className="text-xs font-semibold text-slate-500 uppercase tracking-wider flex items-center gap-1.5">
                  <Camera className="h-3.5 w-3.5 text-violet-600" /> Photos
                  {(photosAdded.length > 0 || photosRemoved.length > 0) && (
                    <span className="ml-auto text-[10px] normal-case font-semibold text-amber-600">changed</span>
                  )}
                </h3>
                <PhotoPicker photos={photos} onChange={setPhotos} onBusyChange={setPhotosUploading} />
              </section>
            )}

            {/* Customer + references */}
            <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
              <section className="bg-white border border-slate-200 rounded-2xl p-4 space-y-1">
                <h3 className="text-xs font-semibold text-slate-500 uppercase tracking-wider flex items-center gap-1.5 mb-2">
                  <MapPin className="h-3.5 w-3.5 text-emerald-600" /> Customer
                </h3>
                <div className="text-sm font-bold text-slate-900">{lead.customerName}</div>
                {lead.customerPhone ? (
                  <div className="flex items-center gap-2">
                    <a href={`tel:${lead.customerPhone}`} className="text-sm font-semibold text-blue-600 hover:underline font-mono">
                      {lead.customerPhone}
                    </a>
                    <CopyRef label="" value={lead.customerPhone} className="[&>span:nth-child(2)]:hidden" />
                  </div>
                ) : (
                  <div className="text-xs text-slate-400">No phone — add with Edit</div>
                )}
                <div className="text-xs text-slate-600">{lead.address}</div>
                <div className="text-xs font-semibold text-emerald-600">{lead.city}</div>
              </section>
              <section className="bg-white border border-slate-200 rounded-2xl p-4 space-y-2 text-xs">
                <h3 className="text-xs font-semibold text-slate-500 uppercase tracking-wider flex items-center gap-1.5">
                  <Hash className="h-3.5 w-3.5 text-slate-500" /> References
                </h3>
                <div className="flex items-center justify-between gap-2">
                  <span className="text-slate-500">{lead.orderSource?.name ? `${lead.orderSource.name} order ID` : 'Order ID'}</span>
                  {lead.externalOrderId ? <CopyRef label="" value={lead.externalOrderId} /> : <span className="text-slate-400">—</span>}
                </div>
                <div className="flex items-center justify-between gap-2">
                  <span className="text-slate-500">Tracking</span>
                  {lead.trackingNumber ? <CopyRef label="" value={lead.trackingNumber} /> : <span className="text-slate-400">— add with Edit</span>}
                </div>
                <div className="flex items-center justify-between gap-2 pt-1 border-t border-slate-100">
                  <span className="text-slate-500">DC / Petrol / GST</span>
                  <span className="font-mono text-slate-700">
                    {formatPKR(group.deliveryCharge)} / {formatPKR(group.petrolCost)} / {formatPKR(group.gstAmount)}
                  </span>
                </div>
              </section>
            </div>
          </div>

          {/* ── Footer: delete + save everything ── */}
          <div className="bg-white border-t border-slate-200 px-4 sm:px-6 py-3 pb-[max(0.75rem,env(safe-area-inset-bottom))] flex items-center gap-2">
            <button
              onClick={() => {
                onDeleteSale(lead.id)
                onClose()
              }}
              className="p-2 sm:px-3 rounded-xl text-slate-500 hover:text-rose-600 hover:bg-rose-50 text-xs font-medium flex items-center gap-1 transition"
              title={isParcel ? `Delete order (${group.items.length} items)` : 'Delete order'}
            >
              <Trash2 className="h-4 w-4" /> <span className="hidden sm:inline">Delete</span>
            </button>
            <div className="flex-1" />
            <button
              onClick={handleClose}
              className="px-4 py-2.5 rounded-xl bg-slate-100 hover:bg-slate-200 text-slate-700 text-sm font-semibold transition"
            >
              Cancel
            </button>
            <button
              onClick={handleSave}
              disabled={isSaving || !isDirty || photosUploading}
              className="px-5 py-2.5 rounded-xl bg-emerald-500 hover:bg-emerald-600 text-white text-sm font-bold flex items-center gap-1.5 transition shadow-lg shadow-emerald-500/20 disabled:opacity-40 disabled:shadow-none"
            >
              <Save className="h-4 w-4" />
              {isSaving ? 'Saving...' : isDirty ? `Save changes (${changeCount})` : 'No changes'}
            </button>
          </div>

        </div>
      </aside>
    </div>
  )
}
