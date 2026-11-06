'use client'

import React, { useState, useEffect, useMemo, useRef } from 'react'
import { createPortal } from 'react-dom'
import { Search, Package, MapPin, CheckCircle2, Clock, Banknote, SlidersHorizontal, ChevronDown, Camera, Pencil, Phone, X } from 'lucide-react'
import StatusBadge from './ui/StatusBadge'
import CopyRef from './ui/CopyRef'
import { groupSales, groupAsSale, OrderGroup } from '@/lib/parcels'

export type SupplierPaymentStatus = 'PENDING' | 'PAID' | 'NOT_APPLICABLE'
export type CustomerPaymentStatus = 'NOT_RECEIVED' | 'RECEIVED' | 'NOT_APPLICABLE'

export interface Sale {
  id: string
  productName: string
  customerName: string
  customerPhone?: string | null
  address: string
  city: string
  quantity: number
  costPrice: number
  soldPrice: number
  deliveryCharge: number
  petrolCost: number
  gstAmount: number
  returnLoss: number
  profit: number
  status: 'PACKING' | 'DISPATCHED' | 'DELIVERED' | 'RETURNED' | 'CANCELLED'
  deductDeliveryOnReturn: boolean
  supplierPaymentStatus: SupplierPaymentStatus
  supplierPaidAt?: string | null
  returnedItemId?: string | null
  createdAt: string
  product?: {
    name: string
  } | null
  category?: { id: string; name: string } | null
  supplier?: { id: string; name: string } | null
  paymentStatus: CustomerPaymentStatus
  paymentReceivedAt?: string | null
  receivedAmount?: number | null
  parcelId?: string | null
  orderNo?: number | null
  externalOrderId?: string | null
  trackingNumber?: string | null
  imageCount?: number // photos attached to the order
  imageUrl?: string | null // first photo URL for thumbnail
  paymentSource?: { id: string; name: string } | null
  orderSource?: { id: string; name: string } | null
  receivedBy?: { id: string; name: string } | null
  dcPaidBy?: { id: string; name: string } | null
}

export interface OrderFilters {
  receivedById: string // '' | person id | 'none'
  missingRef: string // '' | '1' (no order ID and no tracking yet)
  orderSourceId: string // '' | source id | 'none'
  categoryId: string
  supplierId: string
  supplierPayment: string // '' | 'PENDING' | 'PAID'
  olderThanDays: string // '' | '15'
  paymentSourceId: string // '' | source id | 'none'
  paymentStatus: string // '' | 'NOT_RECEIVED' | 'RECEIVED'
}

export const EMPTY_ORDER_FILTERS: OrderFilters = {
  receivedById: '',
  missingRef: '',
  orderSourceId: '',
  categoryId: '',
  supplierId: '',
  supplierPayment: '',
  olderThanDays: '',
  paymentSourceId: '',
  paymentStatus: '',
}

interface Option {
  id: string
  name: string
}

interface OrderListProps {
  sales: Sale[]
  isLoading?: boolean
  searchQuery: string
  setSearchQuery: (q: string) => void
  statusFilter: string
  setStatusFilter: (s: string) => void
  // The date range is picked in the top bar; these stay for compatibility
  startDate?: string
  setStartDate?: (d: string) => void
  endDate?: string
  setEndDate?: (d: string) => void
  setDateRange?: (r: string) => void
  filters: OrderFilters
  setFilters: (f: OrderFilters) => void
  onSetSupplierPayment: (saleIds: string[], status: 'PAID' | 'PENDING') => Promise<void>
  onSetCustomerPayment: (saleIds: string[], status: 'RECEIVED' | 'NOT_RECEIVED') => Promise<void>
  onReceivePayment: (sale: Sale) => void // opens the "actual amount received" popup
  onEditOrder: (items: Sale[]) => void // opens the order form in edit mode
  onSelectOrder: (sale: Sale) => void
}

// Money we receive for the order (from Daraz, courier COD, etc.)
export function PaymentBadge({
  status,
  onClick,
}: {
  status: CustomerPaymentStatus
  onClick?: () => void
}) {
  if (status === 'NOT_APPLICABLE') {
    return <span className="text-[11px] text-slate-400">—</span>
  }
  const received = status === 'RECEIVED'
  return (
    <button
      type="button"
      onClick={onClick}
      title={onClick ? `Click to mark ${received ? 'Not received' : 'Received'}` : undefined}
      className={`px-2 py-0.5 rounded-full text-[10px] font-bold border inline-flex items-center gap-1 whitespace-nowrap transition ${
        received
          ? 'bg-emerald-500/15 text-emerald-600 border-emerald-500/30 hover:bg-emerald-500/25'
          : 'bg-rose-500/10 text-rose-600 border-rose-500/30 hover:bg-rose-500/20'
      }`}
    >
      {received ? <CheckCircle2 className="h-3 w-3" /> : <Banknote className="h-3 w-3" />}
      {received ? 'Received' : 'Not received'}
    </button>
  )
}

export function SupplierPayBadge({
  status,
  onClick,
}: {
  status: SupplierPaymentStatus
  onClick?: () => void
}) {
  if (status === 'NOT_APPLICABLE') {
    return <span className="text-[11px] text-slate-400">—</span>
  }
  const paid = status === 'PAID'
  return (
    <button
      type="button"
      onClick={onClick}
      title={onClick ? `Click to mark ${paid ? 'Pending' : 'Paid'}` : undefined}
      className={`px-2 py-0.5 rounded-full text-[10px] font-bold border inline-flex items-center gap-1 whitespace-nowrap transition ${
        paid
          ? 'bg-emerald-500/15 text-emerald-600 border-emerald-500/30 hover:bg-emerald-500/25'
          : 'bg-amber-500/15 text-amber-600 border-amber-500/30 hover:bg-amber-500/25'
      }`}
    >
      {paid ? <CheckCircle2 className="h-3 w-3" /> : <Clock className="h-3 w-3" />}
      {paid ? 'Paid' : 'Pending'}
    </button>
  )
}

// Supplier payment for an order; a parcel shows Paid only when every product's supplier is paid
function GroupSupplierBadge({ g, onClick }: { g: OrderGroup; onClick?: () => void }) {
  if (g.items.length === 1) return <SupplierPayBadge status={g.lead.supplierPaymentStatus} onClick={onClick} />
  if (g.supplierTracked === 0) return <span className="text-[11px] text-slate-400">—</span>
  const allPaid = g.supplierPending === 0
  return (
    <button
      type="button"
      onClick={onClick}
      title={allPaid ? 'Click to mark all Pending' : 'Click to mark all Paid'}
      className={`px-2 py-0.5 rounded-full text-[10px] font-bold border inline-flex items-center gap-1 whitespace-nowrap transition ${
        allPaid
          ? 'bg-emerald-500/15 text-emerald-600 border-emerald-500/30 hover:bg-emerald-500/25'
          : 'bg-amber-500/15 text-amber-600 border-amber-500/30 hover:bg-amber-500/25'
      }`}
    >
      {allPaid ? <CheckCircle2 className="h-3 w-3" /> : <Clock className="h-3 w-3" />}
      {allPaid ? 'Paid' : `Pending ${g.supplierPending}/${g.supplierTracked}`}
    </button>
  )
}

const cloudinarySized = (url: string, transform: string) => url.replace('/upload/', `/upload/${transform}/`)

const PREVIEW_W = 340 // hover preview size (px)
const PREVIEW_H = 420

// Order photo thumbnail. On a mouse / trackpad, hovering pops a large preview out of the table
// (rendered on <body>, so the table's scroll area never clips it). The preview shows the full,
// uncropped photo and pans with the cursor: move up/down (or left/right) on the thumbnail to see that part.
function OrderThumb({ sale, size = 64 }: { sale: Sale; size?: number }) {
  const [anchor, setAnchor] = useState<DOMRect | null>(null)
  const [pan, setPan] = useState({ x: 50, y: 50 }) // % position inside the photo
  const canHover = useRef(false)

  useEffect(() => {
    canHover.current = window.matchMedia?.('(hover: hover) and (pointer: fine)').matches ?? false
  }, [])

  const url = sale.imageUrl
  if (!url) {
    return (
      <div
        className="rounded-xl bg-gradient-to-br from-slate-100 to-slate-50 border border-dashed border-slate-200 flex items-center justify-center flex-shrink-0"
        style={{ width: size, height: size }}
      >
        <Package className="h-5 w-5 text-slate-300" />
      </div>
    )
  }

  // Place the preview to the right of the thumbnail (or left if there is no room), kept on screen
  let preview: React.ReactNode = null
  if (anchor && typeof document !== 'undefined') {
    const gap = 14
    const fitsRight = anchor.right + gap + PREVIEW_W < window.innerWidth - 8
    const left = fitsRight ? anchor.right + gap : Math.max(8, anchor.left - gap - PREVIEW_W)
    const top = Math.min(Math.max(8, anchor.top + anchor.height / 2 - PREVIEW_H / 2), window.innerHeight - PREVIEW_H - 8)
    preview = createPortal(
      <div
        className="photo-zoom fixed z-[60] pointer-events-none rounded-2xl overflow-hidden bg-slate-900 shadow-2xl ring-1 ring-slate-900/10"
        style={{ left, top, width: PREVIEW_W, height: PREVIEW_H, transformOrigin: fitsRight ? 'left center' : 'right center' }}
      >
        {/* full photo (not cropped), panned to where the cursor is on the thumbnail */}
        {/* eslint-disable-next-line @next/next/no-img-element */}
        <img
          src={cloudinarySized(url, 'c_limit,w_1000,q_auto,f_auto')}
          alt=""
          className="w-full h-full object-cover transition-[object-position] duration-150 ease-out"
          style={{ objectPosition: `${pan.x}% ${pan.y}%` }}
        />
        <span className="absolute top-2 left-2 bg-black/50 text-white text-[10px] font-medium px-2 py-0.5 rounded-full">
          Move the cursor to see more
        </span>
        {!!sale.imageCount && sale.imageCount > 1 && (
          <span className="absolute bottom-2 right-2 bg-black/60 text-white text-[11px] font-semibold px-2 py-0.5 rounded-full">
            1 / {sale.imageCount}
          </span>
        )}
      </div>,
      document.body
    )
  }

  return (
    <div
      className="relative rounded-xl overflow-hidden bg-slate-100 border border-slate-200/80 shadow-sm flex-shrink-0 cursor-zoom-in"
      style={{ width: size, height: size }}
      onMouseEnter={(e) => {
        if (!canHover.current) return
        setPan({ x: 50, y: 50 })
        setAnchor(e.currentTarget.getBoundingClientRect())
      }}
      onMouseMove={(e) => {
        if (!anchor) return
        const r = e.currentTarget.getBoundingClientRect()
        const clamp = (v: number) => Math.min(100, Math.max(0, v))
        setPan({ x: clamp(((e.clientX - r.left) / r.width) * 100), y: clamp(((e.clientY - r.top) / r.height) * 100) })
      }}
      onMouseLeave={() => setAnchor(null)}
    >
      {/* eslint-disable-next-line @next/next/no-img-element */}
      <img
        src={cloudinarySized(url, `c_fill,w_${size * 2},h_${size * 2},q_auto,f_auto`)}
        alt=""
        className="w-full h-full object-cover"
        loading="lazy"
      />
      {!!sale.imageCount && sale.imageCount > 1 && (
        <span className="absolute bottom-0 right-0 bg-black/60 text-white text-[9px] font-bold px-1 py-px rounded-tl-md">
          +{sale.imageCount - 1}
        </span>
      )}
      {preview}
    </div>
  )
}

const dateLabel = (iso: string) => new Date(iso).toLocaleDateString('en-GB', { day: 'numeric', month: 'short', year: 'numeric' })
const timeLabel = (iso: string) => new Date(iso).toLocaleTimeString('en-US', { hour: 'numeric', minute: '2-digit', hour12: true })

export default function OrderList({
  sales,
  isLoading,
  searchQuery,
  setSearchQuery,
  statusFilter,
  setStatusFilter,
  filters,
  setFilters,
  onSetSupplierPayment,
  onSetCustomerPayment,
  onReceivePayment,
  onEditOrder,
  onSelectOrder,
}: OrderListProps) {
  const formatPKR = (amt: number) => `Rs. ${Math.round(amt).toLocaleString()}`

  const [categories, setCategories] = useState<Option[]>([])
  const [suppliers, setSuppliers] = useState<Option[]>([])
  const [paymentSources, setPaymentSources] = useState<Option[]>([])
  const [orderSources, setOrderSources] = useState<Option[]>([])
  const [people, setPeople] = useState<Option[]>([])
  const [selectedIds, setSelectedIds] = useState<string[]>([])
  const [isBulkUpdating, setIsBulkUpdating] = useState(false)
  const [showFilters, setShowFilters] = useState(false)

  useEffect(() => {
    Promise.all([
      fetch('/api/categories').then((r) => r.json()),
      fetch('/api/suppliers').then((r) => r.json()),
      fetch('/api/payment-sources').then((r) => r.json()),
      fetch('/api/order-sources').then((r) => r.json()),
      fetch('/api/people').then((r) => r.json()),
    ])
      .then(([cats, sups, srcs, orderSrcs, ppl]) => {
        if (Array.isArray(ppl)) setPeople(ppl)
        if (Array.isArray(orderSrcs)) setOrderSources(orderSrcs)
        if (Array.isArray(cats)) setCategories(cats)
        if (Array.isArray(sups)) setSuppliers(sups)
        if (Array.isArray(srcs)) setPaymentSources(srcs)
      })
      .catch(console.error)
  }, [])

  // Drop selections that are no longer in the visible list
  useEffect(() => {
    setSelectedIds((prev) => prev.filter((id) => sales.some((s) => s.id === id)))
  }, [sales])

  const allSelected = sales.length > 0 && sales.every((s) => selectedIds.includes(s.id))
  const selectedSales = sales.filter((s) => selectedIds.includes(s.id))
  const selectedToReceive = selectedSales
    .filter((s) => s.paymentStatus === 'NOT_RECEIVED')
    .reduce((acc, s) => acc + (s.receivedAmount ?? s.soldPrice * s.quantity), 0)
  const selectedOwedToSupplier = selectedSales
    .filter((s) => s.supplierPaymentStatus === 'PENDING')
    .reduce((acc, s) => acc + s.costPrice * s.quantity, 0)

  // A parcel is one row: it is selected, paid and received as a whole
  const groups = useMemo(() => groupSales(sales), [sales])

  const toggleGroup = (g: OrderGroup) =>
    setSelectedIds((prev) =>
      g.ids.every((id) => prev.includes(id)) ? prev.filter((x) => !g.ids.includes(x)) : Array.from(new Set([...prev, ...g.ids]))
    )

  // Receiving asks for the actual amount; undoing goes straight back to "not received"
  const togglePayment = (g: OrderGroup) =>
    g.lead.paymentStatus === 'RECEIVED' ? onSetCustomerPayment(g.ids, 'NOT_RECEIVED') : onReceivePayment(groupAsSale(g))

  const toggleSupplier = (g: OrderGroup) => onSetSupplierPayment(g.ids, g.supplierPending > 0 ? 'PAID' : 'PENDING')

  const groupTitle = (g: OrderGroup) =>
    g.items.length === 1 ? g.lead.productName : g.items.map((i) => i.productName).join(', ')

  const runBulk = async (action: () => Promise<void>) => {
    setIsBulkUpdating(true)
    try {
      await action()
      setSelectedIds([])
    } finally {
      setIsBulkUpdating(false)
    }
  }

  const activeFilterCount = Object.values(filters).filter(Boolean).length
  const hasFilters = activeFilterCount > 0

  const selectClass =
    'w-full bg-white border border-slate-300 rounded-xl px-2.5 py-2 text-xs text-slate-800 focus:outline-none focus:border-emerald-500'

  const statusTabs = [
    { label: 'All', value: 'ALL', dot: '' },
    { label: 'Packing', value: 'PACKING', dot: 'bg-amber-500' },
    { label: 'Dispatched', value: 'DISPATCHED', dot: 'bg-blue-500' },
    { label: 'Delivered', value: 'DELIVERED', dot: 'bg-emerald-500' },
    { label: 'Returned', value: 'RETURNED', dot: 'bg-rose-500' },
    { label: 'Cancelled', value: 'CANCELLED', dot: 'bg-slate-400' },
  ]

  // Profit is only real once delivered / returned; before that show what the cover cost
  const amountNote = (g: OrderGroup) =>
    g.lead.status === 'DELIVERED' || g.lead.status === 'RETURNED' ? (
      <span className={g.profit >= 0 ? 'text-emerald-600' : 'text-rose-600'}>
        Profit {g.profit >= 0 ? '+' : ''}{formatPKR(g.profit)}
      </span>
    ) : (
      <span className="text-slate-400">Cost {formatPKR(g.costTotal)}</span>
    )

  const customerLine = (sale: Sale) =>
    sale.customerName !== 'Walk-in' || sale.city !== 'General' || sale.customerPhone ? (
      <div className="flex items-center gap-1 text-[11px] text-slate-500 min-w-0">
        <MapPin className="h-3 w-3 text-emerald-500 shrink-0" />
        <span className="truncate">
          {sale.customerName}
          {sale.city !== 'General' ? `, ${sale.city}` : ''}
        </span>
        {sale.customerPhone && (
          <span className="flex items-center gap-0.5 shrink-0 text-slate-400">
            <Phone className="h-3 w-3" />
            {sale.customerPhone}
          </span>
        )}
      </div>
    ) : null

  return (
    <div className="bg-white border border-slate-200 rounded-2xl shadow-sm">

      {/* ── Top bar: status tabs · search · filters ── */}
      <div className="p-3 sm:p-4 border-b border-slate-100 space-y-3">
        <div className="flex flex-col md:flex-row md:items-center gap-3">
          <div className="flex flex-wrap items-center gap-1 bg-slate-100 rounded-xl p-1">
            {statusTabs.map((tab) => (
              <button
                key={tab.value}
                onClick={() => setStatusFilter(tab.value)}
                className={`px-3 py-1.5 rounded-lg text-xs font-semibold whitespace-nowrap transition flex items-center gap-1.5 ${
                  statusFilter === tab.value ? 'bg-white text-slate-900 shadow-sm' : 'text-slate-500 hover:text-slate-800'
                }`}
              >
                {tab.dot && <span className={`w-1.5 h-1.5 rounded-full ${tab.dot}`} />}
                {tab.label}
              </button>
            ))}
          </div>

          <div className="flex items-center gap-2 md:ml-auto w-full md:w-auto">
            <div className="relative flex-1 md:w-72">
              <Search className="absolute left-3 top-2.5 h-4 w-4 text-slate-400" />
              <input
                type="text"
                value={searchQuery}
                onChange={(e) => setSearchQuery(e.target.value)}
                placeholder="Search #, order ID, tracking, phone, item..."
                className="w-full bg-slate-50 border border-slate-200 rounded-xl pl-9 pr-3 py-2 text-xs text-slate-800 focus:outline-none focus:border-emerald-500 focus:bg-white focus:ring-2 focus:ring-emerald-500/10 transition-all"
              />
            </div>
            <button
              onClick={() => setShowFilters((v) => !v)}
              className={`shrink-0 flex items-center gap-1.5 px-3 py-2 rounded-xl border text-xs font-semibold transition ${
                hasFilters || showFilters
                  ? 'bg-emerald-50 border-emerald-200 text-emerald-700'
                  : 'bg-white border-slate-200 text-slate-600 hover:border-slate-300'
              }`}
            >
              <SlidersHorizontal className="h-4 w-4" />
              Filters
              {hasFilters && (
                <span className="min-w-[18px] h-[18px] px-1 rounded-full bg-emerald-500 text-white text-[10px] font-bold flex items-center justify-center">
                  {activeFilterCount}
                </span>
              )}
              <ChevronDown className={`h-3.5 w-3.5 transition ${showFilters ? 'rotate-180' : ''}`} />
            </button>
          </div>
        </div>

        {/* More filters (hidden until "Filters" is opened) */}
        {showFilters && (
          <div className="rounded-xl bg-slate-50 border border-slate-200 p-3 space-y-3">
            <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-2">
              <select value={filters.orderSourceId} onChange={(e) => setFilters({ ...filters, orderSourceId: e.target.value })} className={selectClass}>
                <option value="">Order from: All</option>
                {orderSources.map((s) => (
                  <option key={s.id} value={s.id}>Order from: {s.name}</option>
                ))}
                <option value="none">Order from: not set</option>
              </select>
              <select value={filters.categoryId} onChange={(e) => setFilters({ ...filters, categoryId: e.target.value })} className={selectClass}>
                <option value="">All categories</option>
                {categories.map((c) => (
                  <option key={c.id} value={c.id}>{c.name}</option>
                ))}
              </select>
              <select value={filters.supplierId} onChange={(e) => setFilters({ ...filters, supplierId: e.target.value })} className={selectClass}>
                <option value="">All suppliers</option>
                {suppliers.map((s) => (
                  <option key={s.id} value={s.id}>{s.name}</option>
                ))}
              </select>
              <select value={filters.supplierPayment} onChange={(e) => setFilters({ ...filters, supplierPayment: e.target.value })} className={selectClass}>
                <option value="">Supplier payment: All</option>
                <option value="PENDING">Supplier payment: Pending</option>
                <option value="PAID">Supplier payment: Paid</option>
              </select>
              <select value={filters.paymentSourceId} onChange={(e) => setFilters({ ...filters, paymentSourceId: e.target.value })} className={selectClass}>
                <option value="">All payment sources</option>
                {paymentSources.map((s) => (
                  <option key={s.id} value={s.id}>{s.name}</option>
                ))}
                <option value="none">No source set</option>
              </select>
              <select value={filters.receivedById} onChange={(e) => setFilters({ ...filters, receivedById: e.target.value })} className={selectClass}>
                <option value="">Money goes to: All</option>
                {people.map((p) => (
                  <option key={p.id} value={p.id}>Money goes to: {p.name}</option>
                ))}
                <option value="none">Money goes to: not set</option>
              </select>
              <select value={filters.paymentStatus} onChange={(e) => setFilters({ ...filters, paymentStatus: e.target.value })} className={selectClass}>
                <option value="">Payment: All</option>
                <option value="NOT_RECEIVED">Payment: Not received</option>
                <option value="RECEIVED">Payment: Received</option>
              </select>
            </div>
            <div className="flex flex-wrap items-center gap-2">
              <button
                onClick={() =>
                  filters.olderThanDays
                    ? setFilters({ ...filters, olderThanDays: '' })
                    : setFilters({ ...filters, supplierPayment: 'PENDING', olderThanDays: '15' })
                }
                className={`px-3 py-1.5 rounded-lg text-xs font-semibold border transition ${
                  filters.olderThanDays ? 'bg-rose-500/15 text-rose-700 border-rose-500/40' : 'bg-white text-slate-600 border-slate-200 hover:border-slate-300'
                }`}
              >
                Supplier pending 15+ days
              </button>
              <button
                onClick={() => setFilters({ ...filters, missingRef: filters.missingRef ? '' : '1' })}
                className={`px-3 py-1.5 rounded-lg text-xs font-semibold border transition ${
                  filters.missingRef ? 'bg-blue-500/15 text-blue-700 border-blue-500/40' : 'bg-white text-slate-600 border-slate-200 hover:border-slate-300'
                }`}
              >
                Missing tracking / ID
              </button>
              {hasFilters && (
                <button
                  onClick={() => setFilters(EMPTY_ORDER_FILTERS)}
                  className="ml-auto text-xs text-slate-500 hover:text-rose-600 font-semibold flex items-center gap-1"
                >
                  <X className="h-3.5 w-3.5" /> Clear filters
                </button>
              )}
            </div>
          </div>
        )}
      </div>

      {/* ── Bulk action bar ── */}
      {selectedIds.length > 0 && (
        <div className="sticky bottom-3 z-20 lg:static mx-3 sm:mx-4 mt-3 flex flex-wrap items-center justify-between gap-2 bg-gradient-to-r from-emerald-50 to-teal-50 border border-emerald-200 rounded-xl px-3 sm:px-4 py-2.5 text-xs shadow-lg lg:shadow-none">
          <span className="text-emerald-700 font-semibold">
            {groups.filter((g) => g.ids.some((id) => selectedIds.includes(id))).length} order(s) selected · to receive {formatPKR(selectedToReceive)} · owed to supplier{' '}
            {formatPKR(selectedOwedToSupplier)}
          </span>
          <div className="grid grid-cols-3 sm:flex sm:flex-wrap gap-2 w-full sm:w-auto">
            <button onClick={() => setSelectedIds([])} className="px-3 py-2 sm:py-1 rounded-lg bg-white border border-slate-200 text-slate-700 font-semibold hover:bg-slate-50 transition">
              Clear
            </button>
            <button
              onClick={() => runBulk(() => onSetCustomerPayment(selectedIds, 'RECEIVED'))}
              disabled={isBulkUpdating}
              className="px-3 py-2 sm:py-1 rounded-lg bg-emerald-500 text-white font-bold disabled:opacity-50 hover:bg-emerald-600 transition shadow-sm"
            >
              {isBulkUpdating ? 'Updating...' : 'Payment Received'}
            </button>
            <button
              onClick={() => runBulk(() => onSetSupplierPayment(selectedIds, 'PAID'))}
              disabled={isBulkUpdating}
              className="px-3 py-2 sm:py-1 rounded-lg bg-amber-500 text-white font-bold disabled:opacity-50 hover:bg-amber-600 transition shadow-sm"
            >
              {isBulkUpdating ? 'Updating...' : 'Supplier Paid'}
            </button>
          </div>
        </div>
      )}

      {/* ── Orders ── */}
      <div className="p-3 sm:p-4">
        {isLoading ? (
          <div className="space-y-2">
            {[...Array(5)].map((_, i) => (
              <div key={i} className="flex items-center gap-3 p-2">
                <div className="w-16 h-16 bg-slate-100 rounded-xl animate-pulse" />
                <div className="flex-1 space-y-2">
                  <div className="h-3 bg-slate-100 rounded animate-pulse w-2/3" />
                  <div className="h-2.5 bg-slate-100/60 rounded animate-pulse w-1/3" />
                </div>
                <div className="h-6 w-20 bg-slate-100 rounded-full animate-pulse" />
              </div>
            ))}
          </div>
        ) : sales.length === 0 ? (
          <div className="p-14 text-center border border-dashed border-slate-200 rounded-xl bg-gradient-to-b from-slate-50/50 to-white">
            <div className="w-14 h-14 mx-auto mb-3 rounded-2xl bg-slate-100 flex items-center justify-center">
              <Package className="h-7 w-7 text-slate-300" />
            </div>
            <p className="text-slate-600 font-semibold text-sm">No orders found</p>
            <p className="text-slate-400 text-xs mt-1">Try another status, search or filter.</p>
          </div>
        ) : (
          <>
            {/* ── Phones & tablets: one card per order / parcel ── */}
            <div className="lg:hidden space-y-2.5">
              <label className="flex items-center gap-2 text-xs text-slate-500 px-1">
                <input
                  type="checkbox"
                  checked={allSelected}
                  onChange={() => setSelectedIds(allSelected ? [] : sales.map((s) => s.id))}
                  className="h-4 w-4 accent-emerald-500 rounded"
                />
                Select all ({groups.length})
              </label>

              {groups.map((g) => {
                const sale = g.lead
                const isSelected = g.ids.every((id) => selectedIds.includes(id))
                return (
                  <div
                    key={g.key}
                    onClick={() => onSelectOrder(sale)}
                    className={`rounded-2xl border p-3 space-y-2.5 transition cursor-pointer ${
                      isSelected ? 'border-emerald-300 bg-emerald-50/50' : 'border-slate-200 bg-white hover:border-slate-300'
                    }`}
                  >
                    <div className="flex gap-3">
                      <input
                        type="checkbox"
                        checked={isSelected}
                        onClick={(e) => e.stopPropagation()}
                        onChange={() => toggleGroup(g)}
                        className="h-4 w-4 mt-1 accent-emerald-500 shrink-0 rounded"
                      />
                      <OrderThumb sale={sale} size={64} />
                      <div className="min-w-0 flex-1 space-y-0.5">
                        {/* date first, then the order */}
                        <div className="flex items-center justify-between gap-2 text-[11px] text-slate-500">
                          <span>
                            {dateLabel(sale.createdAt)} · {timeLabel(sale.createdAt)}
                          </span>
                          {sale.orderNo && <span className="font-mono font-bold text-slate-400">#{sale.orderNo}</span>}
                        </div>
                        <div className="flex items-start justify-between gap-2">
                          <div className="font-semibold text-[13px] text-slate-900 leading-snug break-words">
                            {g.items.length > 1 && (
                              <span className="mr-1 px-1.5 py-px rounded-md bg-slate-800 text-white text-[10px] font-bold align-middle">{g.items.length} items</span>
                            )}
                            {groupTitle(g)}
                          </div>
                          <div className="text-right shrink-0 font-mono">
                            <div className="text-sm font-bold text-slate-900">{formatPKR(g.saleTotal)}</div>
                            <div className="text-[10px] font-semibold">{amountNote(g)}</div>
                          </div>
                        </div>
                        <div className="flex flex-wrap items-center gap-x-1.5 gap-y-0.5 text-[11px] text-slate-500">
                          {sale.orderSource?.name && (
                            <span className="px-1.5 py-px rounded-md bg-violet-50 text-violet-700 border border-violet-100 font-semibold text-[10px]">{sale.orderSource.name}</span>
                          )}
                          {g.items.length === 1 && sale.category?.name && <span className="text-sky-600 font-medium">{sale.category.name}</span>}
                          {g.items.length === 1 && <span>Qty {sale.quantity}</span>}
                          {!!sale.imageCount && (
                            <span className="inline-flex items-center gap-0.5 text-violet-700"><Camera className="h-3 w-3" />{sale.imageCount}</span>
                          )}
                        </div>
                        {(sale.externalOrderId || sale.trackingNumber) && (
                          <div className="flex flex-wrap gap-x-2" onClick={(e) => e.stopPropagation()}>
                            {sale.externalOrderId && <CopyRef label={sale.orderSource?.name || 'Order ID'} value={sale.externalOrderId} />}
                            {sale.trackingNumber && <CopyRef label="TRK" value={sale.trackingNumber} />}
                          </div>
                        )}
                        {customerLine(sale)}
                      </div>
                    </div>

                    <div className="grid grid-cols-3 gap-2 border-t border-slate-100 pt-2" onClick={(e) => e.stopPropagation()}>
                      <div className="space-y-1 min-w-0">
                        <div className="text-[10px] text-slate-400 uppercase font-medium tracking-wide">Status</div>
                        <StatusBadge status={sale.status} />
                      </div>
                      <div className="space-y-1 min-w-0">
                        <div className="text-[10px] text-slate-400 uppercase font-medium tracking-wide truncate">
                          {sale.paymentSource?.name || 'Payment'}
                          {sale.receivedBy?.name ? ` → ${sale.receivedBy.name}` : ''}
                        </div>
                        <PaymentBadge status={sale.paymentStatus} onClick={() => togglePayment(g)} />
                      </div>
                      <div className="space-y-1 min-w-0">
                        <div className="text-[10px] text-slate-400 uppercase font-medium tracking-wide truncate">{g.supplierNames.join(', ') || 'Supplier'}</div>
                        <GroupSupplierBadge g={g} onClick={() => toggleSupplier(g)} />
                      </div>
                    </div>

                    <div className="flex gap-2" onClick={(e) => e.stopPropagation()}>
                      <button
                        onClick={() => onEditOrder(g.items)}
                        className="flex-1 flex items-center justify-center gap-1.5 px-3 py-2 rounded-xl bg-blue-50 border border-blue-200 text-blue-700 text-[11px] font-semibold hover:bg-blue-100 transition"
                      >
                        <Pencil className="h-3 w-3" /> Edit
                      </button>
                    </div>
                  </div>
                )
              })}
            </div>

            {/* ── Desktop: table (photo · date · order · amount · status · payment · supplier) ── */}
            <div className="hidden lg:block overflow-x-auto rounded-xl border border-slate-200">
              <table className="w-full min-w-[880px] table-fixed text-left text-xs text-slate-700">
                {/* fixed widths keep the right-side columns compact so Edit stays visible without scrolling */}
                <colgroup>
                  <col className="w-9" />
                  <col className="w-[80px]" />
                  <col className="w-[92px]" />
                  <col />
                  <col className="w-[100px]" />
                  <col className="w-[112px]" />
                  <col className="w-[124px]" />
                  <col className="w-[100px]" />
                  <col className="w-[48px]" />
                </colgroup>
                <thead>
                  <tr className="bg-slate-50 text-[10px] text-slate-500 uppercase tracking-wider font-semibold border-b border-slate-200">
                    <th className="pl-3 py-2.5">
                      <input
                        type="checkbox"
                        checked={allSelected}
                        onChange={() => setSelectedIds(allSelected ? [] : sales.map((s) => s.id))}
                        title="Select all orders"
                        className="h-3.5 w-3.5 accent-emerald-500 rounded"
                      />
                    </th>
                    <th className="px-2 py-2.5">Photo</th>
                    <th className="px-2 py-2.5">Date</th>
                    <th className="px-3 py-2.5">Order</th>
                    <th className="px-2 py-2.5">Amount</th>
                    <th className="px-2 py-2.5">Status</th>
                    <th className="px-2 py-2.5">Payment</th>
                    <th className="px-2 py-2.5">Supplier</th>
                    <th className="pr-3 pl-1 py-2.5 text-right">Edit</th>
                  </tr>
                </thead>
                <tbody>
                  {groups.map((g) => {
                    const sale = g.lead
                    const isSelected = g.ids.every((id) => selectedIds.includes(id))
                    return (
                      <tr
                        key={g.key}
                        onClick={() => onSelectOrder(sale)}
                        className={`cursor-pointer border-b border-slate-100 last:border-b-0 group/row transition-colors ${
                          isSelected ? 'bg-emerald-50/60 hover:bg-emerald-50' : 'bg-white hover:bg-slate-50'
                        }`}
                      >
                        <td className="pl-3 py-2.5" onClick={(e) => e.stopPropagation()}>
                          <input type="checkbox" checked={isSelected} onChange={() => toggleGroup(g)} className="h-3.5 w-3.5 accent-emerald-500 rounded" />
                        </td>

                        {/* Photo (hover = big preview) */}
                        <td className="px-2 py-2.5" onClick={(e) => e.stopPropagation()}>
                          <div onClick={() => onSelectOrder(sale)}>
                            <OrderThumb sale={sale} size={64} />
                          </div>
                        </td>

                        {/* Date + time */}
                        <td className="px-2 py-2.5 whitespace-nowrap">
                          <div className="text-[12px] font-semibold text-slate-700">{dateLabel(sale.createdAt)}</div>
                          <div className="text-[11px] text-slate-400">{timeLabel(sale.createdAt)}</div>
                        </td>

                        {/* Order details */}
                        <td className="px-3 py-2.5 min-w-0">
                          <div className="flex items-center gap-1.5 min-w-0">
                            {sale.orderNo && <span className="text-[11px] font-bold text-slate-400 font-mono shrink-0">#{sale.orderNo}</span>}
                            {g.items.length > 1 && (
                              <span className="px-1.5 py-px rounded-md bg-slate-800 text-white text-[10px] font-bold shrink-0">{g.items.length} items</span>
                            )}
                            <span className="font-semibold text-slate-900 text-[13px] truncate">{groupTitle(g)}</span>
                          </div>
                          <div className="flex items-center gap-1.5 mt-0.5 text-[11px] text-slate-500 min-w-0">
                            {sale.orderSource?.name && (
                              <span className="px-1.5 py-px rounded-md bg-violet-50 text-violet-700 border border-violet-100 font-semibold text-[10px] shrink-0">
                                {sale.orderSource.name}
                              </span>
                            )}
                            {g.items.length === 1 ? (
                              <span className="truncate">
                                {sale.category?.name && <span className="text-sky-600 font-medium">{sale.category.name} · </span>}
                                Qty {sale.quantity}
                              </span>
                            ) : (
                              <span className="truncate">{g.items.map((i) => `${i.productName} ×${i.quantity}`).join(' · ')}</span>
                            )}
                            {!!sale.imageCount && (
                              <span className="inline-flex items-center gap-0.5 text-violet-700 shrink-0"><Camera className="h-3 w-3" />{sale.imageCount}</span>
                            )}
                          </div>
                          {(sale.externalOrderId || sale.trackingNumber) && (
                            <div className="flex flex-wrap gap-x-3 mt-0.5" onClick={(e) => e.stopPropagation()}>
                              {sale.externalOrderId && <CopyRef label={sale.orderSource?.name || 'Order ID'} value={sale.externalOrderId} />}
                              {sale.trackingNumber && <CopyRef label="TRK" value={sale.trackingNumber} />}
                            </div>
                          )}
                          <div className="mt-0.5">{customerLine(sale)}</div>
                        </td>

                        {/* Amount */}
                        <td className="px-2 py-2.5 font-mono whitespace-nowrap">
                          <div className="text-[13px] font-bold text-slate-900">{formatPKR(g.saleTotal)}</div>
                          <div className="text-[11px] font-semibold mt-0.5">{amountNote(g)}</div>
                        </td>

                        {/* Status */}
                        <td className="px-2 py-2.5">
                          <StatusBadge status={sale.status} />
                        </td>

                        {/* Payment: source → person, received or not */}
                        <td className="px-2 py-2.5" onClick={(e) => e.stopPropagation()}>
                          <div className="text-[11px] text-slate-500 mb-1 truncate">
                            {sale.paymentSource?.name || <span className="text-slate-300">—</span>}
                            {sale.receivedBy?.name && <span className="text-slate-400"> → <b className="text-slate-600">{sale.receivedBy.name}</b></span>}
                          </div>
                          <PaymentBadge status={sale.paymentStatus} onClick={() => togglePayment(g)} />
                        </td>

                        {/* Supplier + its payment */}
                        <td className="px-2 py-2.5" onClick={(e) => e.stopPropagation()}>
                          <div className="text-[11px] text-slate-600 mb-1 truncate">{g.supplierNames.join(', ') || <span className="text-slate-300">—</span>}</div>
                          <GroupSupplierBadge g={g} onClick={() => toggleSupplier(g)} />
                        </td>

                        {/* Actions */}
                        <td className="pr-3 pl-1 py-2.5 text-right" onClick={(e) => e.stopPropagation()}>
                          <div className="flex items-center justify-end gap-1.5 opacity-70 group-hover/row:opacity-100 transition-opacity">
                            <button
                              onClick={() => onEditOrder(g.items)}
                              className="p-1.5 rounded-lg bg-blue-50 hover:bg-blue-100 border border-blue-200/60 text-blue-600 transition"
                              title="Edit order"
                            >
                              <Pencil className="h-3.5 w-3.5" />
                            </button>
                          </div>
                        </td>
                      </tr>
                    )
                  })}
                </tbody>
              </table>
            </div>

            {/* Summary */}
            <div className="mt-3 flex flex-wrap items-center justify-between gap-2 text-[11px] text-slate-500 px-1">
              <span>
                {groups.length} order{groups.length !== 1 ? 's' : ''} · {sales.length} item{sales.length !== 1 ? 's' : ''}
              </span>
              <span className="font-mono font-semibold">
                Total: <span className="text-slate-900">{formatPKR(groups.reduce((a, g) => a + g.saleTotal, 0))}</span>
                {' · '}
                Profit:{' '}
                <span className={groups.reduce((a, g) => a + g.profit, 0) >= 0 ? 'text-emerald-600' : 'text-rose-600'}>
                  {formatPKR(groups.reduce((a, g) => a + g.profit, 0))}
                </span>
              </span>
            </div>
          </>
        )}
      </div>
    </div>
  )
}
