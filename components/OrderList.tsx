'use client'

import React, { useState, useEffect, useMemo, useRef } from 'react'
import { createPortal } from 'react-dom'
import { Search, Package, MapPin, CheckCircle2, Clock, Banknote, SlidersHorizontal, ChevronDown, Camera, Pencil, Phone, X } from 'lucide-react'
import StatusBadge from './ui/StatusBadge'
import CopyRef from './ui/CopyRef'
import Hl from './ui/Highlight'
import { CustomerReplyBadge, WhatsAppMsgStatus, BillStatus, CustomerResponse, WhatsAppMsg } from './ui/WhatsAppStatus'
import { WhatsAppChatButton } from './WhatsAppChat'
import ReturnReceivedToggle from './ui/ReturnReceivedToggle'
import CourierBadge, { CourierCell } from './ui/CourierBadge'
import { BillButton } from './BillDialog'
import ReviewFollowUp, { ReviewStatus, REVIEW_STEPS } from './ui/ReviewFollowUp'
import CheckLeopardsButton from './ui/CheckLeopardsButton'
import { OrderHistoryButton } from './OrderHistory'
import { LeopardsMoneyButton, CourierMoney } from './ui/LeopardsMoney'
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
  // Latest Leopards status (pushed by Leopards)
  courierStatus?: string | null
  courierStatusCode?: string | null
  courierReason?: string | null
  courierStatusAt?: string | null
  imageCount?: number // photos attached to the order
  imageUrl?: string | null // first photo URL for thumbnail
  paymentSource?: { id: string; name: string } | null
  orderSource?: { id: string; name: string } | null
  receivedBy?: { id: string; name: string } | null
  dcPaidBy?: { id: string; name: string } | null
  customerResponse?: CustomerResponse // WhatsApp confirm / cancel reply
  customerRespondedAt?: string | null
  whatsapp?: WhatsAppMsg[] // WhatsApp messages sent for the order
  returnedAt?: string | null // when it was marked Returned
  returnReceived?: boolean // returned parcel physically back with us
  returnReceivedAt?: string | null
  inventoryItemId?: string | null // sold from our own stock
  inventoryHeld?: boolean // the stock is currently taken for this row
  reviewStatus?: ReviewStatus // review follow-up after delivery
  reviewStatusAt?: string | null
  // Leopards money for the parcel (filled by the Leopards check)
  courierCod?: number | null
  courierCharges?: number | null
  courierPayout?: number | null
  courierPayment?: string | null
  courierMoney?: CourierMoney | null
  courierMoneyAt?: string | null
  courierBookedAt?: string | null // booked with Leopards from the app
  hasLeopardsSlip?: boolean // its label can be printed (/api/sales/[id]/leopards/slip)
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
  customerResponse: string // '' | 'PENDING' | 'CONFIRMED' | 'CANCELLED' (WhatsApp reply)
  returnState: string // '' | 'PENDING' (returned, parcel not back yet) | 'RECEIVED'
  reviewStatus: string // '' | 'PENDING' | 'CALLED' | 'REVIEWED' | 'DECLINED'
  attention: string // '' | a "Needs attention" check key (from the Dashboard)
}

// Names of the Dashboard "Needs attention" checks (rules in lib/attention.ts)
export const ATTENTION_LABELS: Record<string, string> = {
  unconfirmed: 'Not confirmed on WhatsApp (24h+)',
  packing_old: 'Still packing (2+ days)',
  stuck_dispatched: 'Parcels with no movement (4+ days)',
  leopards_invoiced: 'Leopards invoiced, not paid yet',
  delivered_unpaid: 'Delivered, money not received (15+ days)',
  return_not_back: 'Returns not back yet (7+ days)',
  reviews: 'Customers to call for a review',
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
  customerResponse: '',
  returnState: '',
  reviewStatus: '',
  attention: '',
}

interface Option {
  id: string
  name: string
}

export interface ListTotals {
  orders: number
  items: number
  sale: number
  profit: number
}

interface OrderListProps {
  sales: Sale[]
  // Orders per status tab with the other filters applied ({ ALL, PACKING, … }); null while unknown
  statusCounts?: Record<string, number> | null
  // Totals of the whole list as filtered (also the months not loaded yet); null while unknown
  totals?: ListTotals | null
  // Month-by-month loading: older months left / the next one is loading / load it
  hasMore?: boolean
  isLoadingMore?: boolean
  onLoadMore?: () => void
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
  onChanged?: () => void // reload after a WhatsApp resend
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
// Month of an order in Pakistan time (UTC+5), e.g. "2026-11" and "November 2026"
const PKT = 5 * 60 * 60 * 1000
const monthKey = (iso: string) => new Date(new Date(iso).getTime() + PKT).toISOString().slice(0, 7)
const monthName = (key: string) =>
  new Date(`${key}-15T00:00:00Z`).toLocaleDateString('en-GB', { month: 'long', year: 'numeric', timeZone: 'UTC' })

const timeLabel = (iso: string) => new Date(iso).toLocaleTimeString('en-US', { hour: 'numeric', minute: '2-digit', hour12: true })

export default function OrderList({
  sales,
  statusCounts,
  totals,
  hasMore = false,
  isLoadingMore = false,
  onLoadMore,
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
  onChanged,
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
  // Count in the list on screen (after tabs / filters / search), counted down: the newest order gets the
  // highest number and the oldest is 1, so a new order does not change the others' numbers.
  // (Orders come newest first; if that ever flips, the oldest still gets 1.)
  // The highest number is the whole list's count (from the server), so it stays right while only the
  // newest months are loaded.
  const totalOrders = totals && totals.orders >= groups.length ? totals.orders : groups.length
  const countOf = useMemo(() => {
    const t = (g: OrderGroup) => new Date(g.lead.createdAt as any).getTime() || 0
    const newestFirst = groups.length < 2 || t(groups[0]) >= t(groups[groups.length - 1])
    return (index: number) => (newestFirst ? totalOrders - index : index + 1)
  }, [groups, totalOrders])

  // Month bands: where each month starts in the list, and how many orders it has (all loaded)
  const monthBands = useMemo(() => {
    const starts = new Map<number, { key: string; count: number }>()
    let last = ''
    groups.forEach((g, i) => {
      const k = monthKey(g.lead.createdAt as any)
      if (k !== last) {
        starts.set(i, { key: k, count: 0 })
        last = k
      }
      const band = Array.from(starts.values()).pop()!
      band.count += 1
    })
    return starts
  }, [groups])

  // Very wide screens (≥1536px) get the separate Date column; laptops show the date inside the Order column
  // Small laptops (<1280px) get a compact table: Leopards + WhatsApp go under Status, Supplier under Payment
  const [tableSize, setTableSize] = useState<'wide' | 'mid' | 'compact'>('mid')
  useEffect(() => {
    const wide = window.matchMedia?.('(min-width: 1536px)')
    const mid = window.matchMedia?.('(min-width: 1280px)')
    if (!wide || !mid) return
    const update = () => setTableSize(wide.matches ? 'wide' : mid.matches ? 'mid' : 'compact')
    update()
    wide.addEventListener?.('change', update)
    mid.addEventListener?.('change', update)
    return () => {
      wide.removeEventListener?.('change', update)
      mid.removeEventListener?.('change', update)
    }
  }, [])
  const wideTable = tableSize === 'wide'
  const compact = tableSize === 'compact'
  const tableCols = 11 - (wideTable ? 0 : 1) - (compact ? 3 : 0)

  // Bottom of the list on screen → load the next older month
  const moreRef = useRef<HTMLDivElement | null>(null)
  const loadMoreRef = useRef(onLoadMore)
  loadMoreRef.current = onLoadMore
  useEffect(() => {
    const el = moreRef.current
    if (!el || !hasMore) return
    const io = new IntersectionObserver((entries) => entries.some((e) => e.isIntersecting) && loadMoreRef.current?.(), { rootMargin: '400px' })
    io.observe(el)
    return () => io.disconnect()
  }, [hasMore, groups.length])

  const toggleGroup = (g: OrderGroup) =>
    setSelectedIds((prev) =>
      g.ids.every((id) => prev.includes(id)) ? prev.filter((x) => !g.ids.includes(x)) : Array.from(new Set([...prev, ...g.ids]))
    )

  // Receiving asks for the actual amount; undoing goes straight back to "not received"
  const togglePayment = (g: OrderGroup) =>
    g.lead.paymentStatus === 'RECEIVED' ? onSetCustomerPayment(g.ids, 'NOT_RECEIVED') : onReceivePayment(groupAsSale(g))

  const toggleSupplier = (g: OrderGroup) => onSetSupplierPayment(g.ids, g.supplierPending > 0 ? 'PAID' : 'PENDING')

  const groupTitle = (g: OrderGroup) => (
    <Hl text={g.items.length === 1 ? g.lead.productName : g.items.map((i) => i.productName).join(', ')} q={searchQuery} />
  )

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
    // delivered orders whose review is still to get (pending or called)
    { label: 'Reviews', value: 'REVIEWS', dot: 'bg-yellow-400' },
    { label: 'Returned', value: 'RETURNED', dot: 'bg-rose-500' },
    { label: 'Cancelled', value: 'CANCELLED', dot: 'bg-slate-400' },
  ]

  // Profit is only real once delivered / returned (shown with the cost); before that show what the cover cost
  const amountNote = (g: OrderGroup) =>
    g.lead.status === 'DELIVERED' || g.lead.status === 'RETURNED' ? (
      <span className="block leading-tight">
        <span className="block text-slate-400">
          Cost <span className="whitespace-nowrap">{formatPKR(g.costTotal)}</span>
        </span>
        <span className={`block ${g.profit >= 0 ? 'text-emerald-600' : 'text-rose-600'}`}>
          Profit{' '}
          <span className="whitespace-nowrap">
            {g.profit >= 0 ? '+' : ''}
            {formatPKR(g.profit)}
          </span>
        </span>
      </span>
    ) : (
      <span className="text-slate-400">Cost {formatPKR(g.costTotal)}</span>
    )

  const customerLine = (sale: Sale) =>
    sale.customerName !== 'Walk-in' || sale.city !== 'General' || sale.customerPhone ? (
      <div className="flex items-center gap-1 text-[11px] text-slate-500 min-w-0">
        <MapPin className="h-3 w-3 text-emerald-500 shrink-0" />
        <span className="truncate">
          <Hl text={sale.customerName} q={searchQuery} />
          {sale.city !== 'General' ? (
            <>
              , <Hl text={sale.city} q={searchQuery} />
            </>
          ) : (
            ''
          )}
        </span>
        {sale.customerPhone && (
          <span className="flex items-center gap-0.5 shrink-0 text-slate-400">
            <Phone className="h-3 w-3" />
            <Hl text={sale.customerPhone} q={searchQuery.replace(/[\s-]/g, '')} />
            {/* copy the number (only the button: the number is already shown) */}
            <CopyRef label="" value={sale.customerPhone} className="[&>span:nth-child(2)]:hidden" />
          </span>
        )}
      </div>
    ) : null

  return (
    // Large screens: the card fills the screen; the top bar and the column headings stay put, only the orders scroll
    <div className="bg-white border border-slate-200 rounded-2xl shadow-sm lg:flex lg:flex-col lg:h-[calc(100dvh-6.75rem)] lg:min-h-[480px]">

      {/* ── Top bar: status tabs · search · filters ── */}
      <div className="p-3 sm:p-4 border-b border-slate-100 space-y-3 lg:shrink-0">
        <div className="flex flex-col 2xl:flex-row 2xl:items-center gap-2 2xl:gap-3">
          <div className="flex flex-wrap items-center gap-1 bg-slate-100 rounded-xl p-1 w-fit max-w-full">
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
                {statusCounts && statusCounts[tab.value] != null && (
                  <span
                    className={`min-w-[18px] px-1 rounded-md text-[10px] font-bold tabular-nums ${
                      statusFilter === tab.value ? 'bg-slate-900 text-white' : 'bg-slate-200 text-slate-600'
                    }`}
                  >
                    {statusCounts[tab.value]}
                  </span>
                )}
              </button>
            ))}
          </div>

          <div className="flex items-center gap-2 2xl:ml-auto w-full 2xl:w-auto">
            <div className="relative flex-1 2xl:w-72">
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
            <CheckLeopardsButton onChanged={onChanged} />
          </div>
        </div>

        {/* Opened from the Dashboard "Needs attention" box */}
        {filters.attention && (
          <div className="flex items-center gap-2 rounded-xl border border-amber-300 bg-amber-50 px-3 py-2 text-xs text-amber-900">
            <span className="font-bold">Needs attention:</span>
            <span>{ATTENTION_LABELS[filters.attention] || filters.attention}</span>
            <button onClick={() => setFilters({ ...filters, attention: '' })} className="ml-auto flex items-center gap-1 font-semibold hover:text-rose-700">
              <X className="h-3.5 w-3.5" /> Show all orders
            </button>
          </div>
        )}

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
              <button
                onClick={() => setFilters({ ...filters, customerResponse: filters.customerResponse === 'CANCELLED' ? '' : 'CANCELLED' })}
                className={`px-3 py-1.5 rounded-lg text-xs font-semibold border transition ${
                  filters.customerResponse === 'CANCELLED' ? 'bg-rose-500/15 text-rose-700 border-rose-500/40' : 'bg-white text-slate-600 border-slate-200 hover:border-slate-300'
                }`}
              >
                Customer cancelled (WhatsApp)
              </button>
              <button
                onClick={() => setFilters({ ...filters, customerResponse: filters.customerResponse === 'PENDING' ? '' : 'PENDING' })}
                className={`px-3 py-1.5 rounded-lg text-xs font-semibold border transition ${
                  filters.customerResponse === 'PENDING' ? 'bg-amber-500/15 text-amber-700 border-amber-500/40' : 'bg-white text-slate-600 border-slate-200 hover:border-slate-300'
                }`}
              >
                Awaiting customer reply
              </button>
              <button
                onClick={() => setFilters({ ...filters, returnState: filters.returnState === 'PENDING' ? '' : 'PENDING' })}
                className={`px-3 py-1.5 rounded-lg text-xs font-semibold border transition ${
                  filters.returnState === 'PENDING' ? 'bg-amber-500/15 text-amber-700 border-amber-500/40' : 'bg-white text-slate-600 border-slate-200 hover:border-slate-300'
                }`}
              >
                Return not received yet
              </button>
              <select
                value={filters.reviewStatus}
                onChange={(e) => setFilters({ ...filters, reviewStatus: e.target.value })}
                title="Review follow-up"
                className={`px-2.5 py-1.5 rounded-lg text-xs font-semibold border transition focus:outline-none ${
                  filters.reviewStatus ? 'bg-yellow-400/15 text-yellow-800 border-yellow-500/40' : 'bg-white text-slate-600 border-slate-200'
                }`}
              >
                <option value="">Review: any</option>
                {REVIEW_STEPS.map((s) => (
                  <option key={s.value} value={s.value}>
                    Review: {s.label}
                  </option>
                ))}
              </select>
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
        <div className="sticky bottom-3 z-20 lg:static lg:shrink-0 mx-3 sm:mx-4 mt-3 flex flex-wrap items-center justify-between gap-2 bg-gradient-to-r from-emerald-50 to-teal-50 border border-emerald-200 rounded-xl px-3 sm:px-4 py-2.5 text-xs shadow-lg lg:shadow-none">
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

      {/* ── Orders (the only part that scrolls on large screens) ── */}
      <div className="p-3 sm:p-4 lg:flex-1 lg:min-h-0 lg:overflow-auto lg:pt-0">
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
                Select all ({groups.length}{hasMore ? ' loaded' : ''})
              </label>

              {groups.map((g, index) => {
                const sale = g.lead
                const isSelected = g.ids.every((id) => selectedIds.includes(id))
                const band = monthBands.get(index)
                return (
                  <React.Fragment key={g.key}>
                  {band && (
                    <div className="flex items-center justify-between rounded-lg bg-slate-800 px-3 py-1.5 text-[11px] font-bold text-white">
                      <span>{monthName(band.key)}</span>
                      <span className="font-mono font-semibold text-slate-300">
                        {band.count} order{band.count !== 1 ? 's' : ''}
                      </span>
                    </div>
                  )}
                  <div
                    onClick={() => onSelectOrder(sale)}
                    className={`rounded-2xl border p-3 space-y-2.5 transition cursor-pointer ${
                      isSelected ? 'border-emerald-300 bg-emerald-50/50' : 'border-slate-200 bg-white hover:border-slate-300'
                    }`}
                  >
                    <div className="flex gap-3">
                      <div className="flex flex-col items-center gap-1 shrink-0">
                        <input
                          type="checkbox"
                          checked={isSelected}
                          onClick={(e) => e.stopPropagation()}
                          onChange={() => toggleGroup(g)}
                          className="h-4 w-4 mt-1 accent-emerald-500 rounded"
                        />
                        <span className="font-mono text-[10px] font-bold text-slate-400" title="Count in this list">{countOf(index)}</span>
                      </div>
                      <OrderThumb sale={sale} size={64} />
                      <div className="min-w-0 flex-1 space-y-0.5">
                        {/* date first, then the order */}
                        <div className="flex items-center justify-between gap-2 text-[11px] text-slate-500">
                          <span>
                            {dateLabel(sale.createdAt)} · {timeLabel(sale.createdAt)}
                          </span>
                          {sale.orderNo && (
                            <span className="font-mono font-bold text-slate-400">
                              #<Hl text={sale.orderNo} q={/^#?\d+$/.test(searchQuery.trim()) ? searchQuery : ''} />
                            </span>
                          )}
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
                            {sale.externalOrderId && <CopyRef label={sale.orderSource?.name || 'Order ID'} value={sale.externalOrderId} highlight={searchQuery} />}
                            {sale.trackingNumber && <CopyRef label="TRK" value={sale.trackingNumber} track highlight={searchQuery} />}
                            <CourierBadge status={sale.courierStatus} code={sale.courierStatusCode} reason={sale.courierReason} at={sale.courierStatusAt} />
                          </div>
                        )}
                        {sale.courierPayout != null && (
                          <div onClick={(e) => e.stopPropagation()}>
                            <LeopardsMoneyButton
                              payout={sale.courierPayout}
                              payment={sale.courierPayment}
                              money={sale.courierMoney}
                              checkedAt={sale.courierMoneyAt}
                              orderNo={sale.orderNo}
                              orderTotal={g.saleTotal}
                            />
                          </div>
                        )}
                        {customerLine(sale)}
                        {(sale.customerResponse && sale.customerResponse !== 'NONE') || sale.whatsapp?.length ? (
                          <div className="flex flex-wrap items-center gap-x-2 gap-y-1 pt-0.5" onClick={(e) => e.stopPropagation()}>
                            <CustomerReplyBadge response={sale.customerResponse} at={sale.customerRespondedAt} />
                            <WhatsAppMsgStatus orderNo={sale.orderNo} orderStatus={sale.status} messages={sale.whatsapp} onChanged={onChanged} />
                            <BillStatus messages={sale.whatsapp} />
                            {!!sale.whatsapp?.length && (
                              <WhatsAppChatButton phone={sale.customerPhone} customerName={sale.customerName} orderNo={sale.orderNo} />
                            )}
                          </div>
                        ) : null}
                      </div>
                    </div>

                    <div className="grid grid-cols-3 gap-2 border-t border-slate-100 pt-2" onClick={(e) => e.stopPropagation()}>
                      <div className="space-y-1 min-w-0">
                        <div className="text-[10px] text-slate-400 uppercase font-medium tracking-wide">Status</div>
                        <StatusBadge status={sale.status} />
                        {sale.status === 'RETURNED' && (
                          <ReturnReceivedToggle
                            compact
                            saleId={sale.id}
                            received={sale.returnReceived}
                            returnedAt={sale.returnedAt}
                            receivedAt={sale.returnReceivedAt}
                            onChanged={onChanged}
                          />
                        )}
                        <ReviewFollowUp
                          compact
                          ids={g.ids}
                          status={sale.reviewStatus}
                          at={sale.reviewStatusAt}
                          phone={sale.customerPhone}
                          orderStatus={sale.status}
                          onChanged={onChanged}
                        />
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
                      <div className="flex-1 flex [&>button]:flex-1 [&>button]:py-2 [&>button]:rounded-xl [&>button]:text-[11px]">
                        <BillButton sale={sale} variant="full" />
                      </div>
                      <div className="flex-1 flex [&>button]:flex-1">
                        <OrderHistoryButton variant="full" orderNo={sale.orderNo} saleId={sale.id} title={`${sale.customerName} · ${formatPKR(g.saleTotal)}`} />
                      </div>
                    </div>
                  </div>
                  </React.Fragment>
                )
              })}
            </div>

            {/* ── Desktop: table (photo · date · order · amount · status · payment · supplier) ── */}
            <div className="hidden lg:block rounded-xl border border-slate-200 lg:mt-3">
              <table className={`w-full table-fixed text-left text-xs text-slate-700 ${wideTable ? 'min-w-[1120px]' : compact ? 'min-w-[640px]' : 'min-w-[980px]'}`}>
                {/* fixed widths keep the right-side columns compact so Edit stays visible without scrolling */}
                <colgroup>
                  <col className="w-9" />
                  <col className={compact ? 'w-[60px]' : 'w-[72px]'} />
                  {wideTable && <col className="w-[92px]" />}
                  <col />
                  {!compact && <col className="w-[118px]" />}
                  <col className={compact ? 'w-[96px]' : 'w-[108px]'} />
                  <col className="w-[136px]" />
                  {!compact && <col className="w-[108px]" />}
                  <col className={compact ? 'w-[116px]' : 'w-[108px]'} />
                  {!compact && <col className="w-[96px]" />}
                  <col className={compact ? 'w-[40px]' : 'w-[44px]'} />
                </colgroup>
                <thead className="sticky top-0 z-20">
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
                    {wideTable && <th className="px-2 py-2.5">Date</th>}
                    <th className="px-3 py-2.5">Order</th>
                    {!compact && <th className="px-2 py-2.5">WhatsApp</th>}
                    <th className="px-2 py-2.5">Amount</th>
                    <th className="px-2 py-2.5">{compact ? 'Status · Leopards' : 'Status'}</th>
                    {!compact && <th className="px-2 py-2.5">Leopards</th>}
                    <th className="px-2 py-2.5">{compact ? 'Payment · Supplier' : 'Payment'}</th>
                    {!compact && <th className="px-2 py-2.5">Supplier</th>}
                    <th className="pr-3 pl-1 py-2.5 text-right">Edit</th>
                  </tr>
                </thead>
                <tbody>
                  {groups.map((g, rowIndex) => {
                    const sale = g.lead
                    const isSelected = g.ids.every((id) => selectedIds.includes(id))
                    // Striped rows: every second order is light grey so rows are easy to tell apart
                    const stripe = rowIndex % 2 === 1 ? 'bg-slate-100/80' : 'bg-white'
                    const band = monthBands.get(rowIndex)
                    const hasWa = (!!sale.customerResponse && sale.customerResponse !== 'NONE') || !!sale.whatsapp?.length
                    const waCell = (
                      <>
                          {(sale.customerResponse && sale.customerResponse !== 'NONE') || !!sale.whatsapp?.length ? (
                            <div className="flex flex-col items-start gap-1 min-w-0">
                              <CustomerReplyBadge response={sale.customerResponse} at={sale.customerRespondedAt} />
                              <div className="max-w-full overflow-hidden">
                                <WhatsAppMsgStatus orderNo={sale.orderNo} orderStatus={sale.status} messages={sale.whatsapp} onChanged={onChanged} />
                              </div>
                              <BillStatus messages={sale.whatsapp} />
                              {!!sale.whatsapp?.length && (
                                <WhatsAppChatButton phone={sale.customerPhone} customerName={sale.customerName} orderNo={sale.orderNo} />
                              )}
                            </div>
                          ) : (
                            <span className="text-slate-300">—</span>
                          )}
                      </>
                    )
                    const leopardsCell = (
                      <>
                          <CourierCell
                            trackingNumber={sale.trackingNumber}
                            status={sale.courierStatus}
                            code={sale.courierStatusCode}
                            reason={sale.courierReason}
                            at={sale.courierStatusAt}
                          />
                          <LeopardsMoneyButton
                            payout={sale.courierPayout}
                            payment={sale.courierPayment}
                            money={sale.courierMoney}
                            checkedAt={sale.courierMoneyAt}
                            orderNo={sale.orderNo}
                            orderTotal={g.saleTotal}
                          />
                          {/* Delivered Leopards parcel whose money was not fetched yet */}
                          {sale.status === 'DELIVERED' &&
                            sale.paymentStatus === 'NOT_RECEIVED' &&
                            sale.courierPayout == null &&
                            /^[A-Z]{2}\d{10}$/i.test((sale.trackingNumber || '').trim()) && (
                              <div className="mt-1 text-[10px] leading-snug text-slate-400" title="Press Check Leopards (or wait for the daily check at 6 pm)">
                                Money: not checked yet
                              </div>
                            )}
                      </>
                    )
                    const supplierCell = (
                      <>
                          <div className="text-[11px] text-slate-600 mb-1 truncate">{g.supplierNames.join(', ') || <span className="text-slate-300">—</span>}</div>
                          <GroupSupplierBadge g={g} onClick={() => toggleSupplier(g)} />
                      </>
                    )
                    return (
                      <React.Fragment key={g.key}>
                      {band && (
                        <tr className="bg-slate-800 text-white">
                          <td colSpan={tableCols} className="px-3 py-1.5 text-[11px] font-bold">
                            {monthName(band.key)}
                            <span className="ml-2 font-mono font-semibold text-slate-300">
                              · {band.count} order{band.count !== 1 ? 's' : ''}
                            </span>
                          </td>
                        </tr>
                      )}
                      <tr
                        onClick={() => onSelectOrder(sale)}
                        className={`cursor-pointer border-b border-slate-200 last:border-b-0 group/row transition-colors ${
                          isSelected ? 'bg-emerald-50 hover:bg-emerald-100/70' : `${stripe} hover:bg-sky-50`
                        }`}
                      >
                        <td className="pl-3 py-2.5" onClick={(e) => e.stopPropagation()}>
                          <div className="flex flex-col items-center gap-1">
                            <input type="checkbox" checked={isSelected} onChange={() => toggleGroup(g)} className="h-3.5 w-3.5 accent-emerald-500 rounded" />
                            <span className="font-mono text-[12px] font-bold text-black" title="Count in this list">{countOf(rowIndex)}</span>
                          </div>
                        </td>

                        {/* Photo (hover = big preview) */}
                        <td className="px-2 py-2.5" onClick={(e) => e.stopPropagation()}>
                          <div onClick={() => onSelectOrder(sale)}>
                            <OrderThumb sale={sale} size={compact ? 44 : 56} />
                          </div>
                        </td>

                        {/* Date + time */}
                        {wideTable && (
                          <td className="px-2 py-2.5 whitespace-nowrap">
                            <div className="text-[12px] font-semibold text-slate-700">{dateLabel(sale.createdAt)}</div>
                            <div className="text-[11px] text-slate-400">{timeLabel(sale.createdAt)}</div>
                          </td>
                        )}

                        {/* Order details */}
                        <td className="px-3 py-2.5 min-w-0">
                          {!wideTable && (
                            <div className="mb-0.5 text-[10px] font-semibold text-slate-400 whitespace-nowrap">
                              {dateLabel(sale.createdAt)} · {timeLabel(sale.createdAt)}
                            </div>
                          )}
                          <div className="flex items-center gap-1.5 min-w-0">
                            {sale.orderNo && (
                              <span className="text-[11px] font-bold text-slate-400 font-mono shrink-0">
                                #<Hl text={sale.orderNo} q={/^#?\d+$/.test(searchQuery.trim()) ? searchQuery : ''} />
                              </span>
                            )}
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
                              {sale.externalOrderId && <CopyRef label={sale.orderSource?.name || 'Order ID'} value={sale.externalOrderId} highlight={searchQuery} />}
                              {sale.trackingNumber && <CopyRef label="TRK" value={sale.trackingNumber} track highlight={searchQuery} />}
                            </div>
                          )}
                          <div className="mt-0.5">{customerLine(sale)}</div>
                        </td>

                        {/* WhatsApp: customer reply, last message, chat */}
                        {!compact && (
                        <td className="px-2 py-2.5 align-middle" onClick={(e) => e.stopPropagation()}>
                          {waCell}
                        </td>
                        )}

                        {/* Amount */}
                        <td className="px-2 py-2.5 font-mono overflow-hidden">
                          <div className="text-[13px] font-bold text-slate-900 whitespace-nowrap">{formatPKR(g.saleTotal)}</div>
                          <div className="text-[11px] font-semibold mt-0.5">{amountNote(g)}</div>
                        </td>

                        {/* Status (overflow-hidden: nothing may spill into the Leopards column) */}
                        <td className="px-2 py-2.5 overflow-hidden" onClick={(e) => e.stopPropagation()}>
                          <div className="flex flex-col items-start gap-1 min-w-0" onClick={() => onSelectOrder(sale)}>
                            <StatusBadge status={sale.status} />
                          </div>
                          {sale.status === 'RETURNED' && (
                            <div className="mt-1">
                              <ReturnReceivedToggle
                                compact
                                saleId={sale.id}
                                received={sale.returnReceived}
                                returnedAt={sale.returnedAt}
                                receivedAt={sale.returnReceivedAt}
                                onChanged={onChanged}
                              />
                            </div>
                          )}
                          <div className="mt-1">
                            <ReviewFollowUp
                              compact
                              ids={g.ids}
                              status={sale.reviewStatus}
                              at={sale.reviewStatusAt}
                              phone={sale.customerPhone}
                              orderStatus={sale.status}
                              onChanged={onChanged}
                            />
                          </div>
                          {compact && (
                            <>
                              {sale.trackingNumber && <div className="mt-1.5 border-t border-slate-200/70 pt-1.5">{leopardsCell}</div>}
                              {hasWa && <div className="mt-1.5 border-t border-slate-200/70 pt-1.5">{waCell}</div>}
                            </>
                          )}
                        </td>

                        {/* Leopards: latest courier status, when, and its note */}
                        {!compact && (
                        <td className="px-2 py-2.5 align-middle overflow-hidden" onClick={(e) => e.stopPropagation()}>
                          {leopardsCell}
                        </td>
                        )}

                        {/* Payment: source → person, received or not */}
                        <td className="px-2 py-2.5" onClick={(e) => e.stopPropagation()}>
                          <div className="text-[11px] text-slate-500 mb-1 truncate">
                            {sale.paymentSource?.name || <span className="text-slate-300">—</span>}
                            {sale.receivedBy?.name && <span className="text-slate-400"> → <b className="text-slate-600">{sale.receivedBy.name}</b></span>}
                          </div>
                          <PaymentBadge status={sale.paymentStatus} onClick={() => togglePayment(g)} />
                          {compact && <div className="mt-2 border-t border-slate-200/70 pt-1.5">{supplierCell}</div>}
                        </td>

                        {/* Supplier + its payment */}
                        {!compact && (
                        <td className="px-2 py-2.5" onClick={(e) => e.stopPropagation()}>
                          {supplierCell}
                        </td>
                        )}

                        {/* Actions */}
                        <td className="pr-3 pl-1 py-2.5 text-right" onClick={(e) => e.stopPropagation()}>
                          <div className="flex flex-col items-end gap-1.5 opacity-70 group-hover/row:opacity-100 transition-opacity">
                            <button
                              onClick={() => onEditOrder(g.items)}
                              className="p-1.5 rounded-lg bg-blue-50 hover:bg-blue-100 border border-blue-200/60 text-blue-600 transition"
                              title="Edit order"
                            >
                              <Pencil className="h-3.5 w-3.5" />
                            </button>
                            <BillButton sale={sale} />
                            <OrderHistoryButton orderNo={sale.orderNo} saleId={sale.id} title={`${sale.customerName} · ${formatPKR(g.saleTotal)}`} />
                          </div>
                        </td>
                      </tr>
                      </React.Fragment>
                    )
                  })}
                </tbody>
              </table>
            </div>

            {/* Older months: loaded when this comes into view */}
            {(hasMore || isLoadingMore) && (
              <div ref={moreRef} className="mt-3 flex justify-center">
                <button
                  type="button"
                  onClick={() => onLoadMore?.()}
                  disabled={isLoadingMore}
                  className="rounded-xl border border-slate-200 bg-white px-4 py-2 text-xs font-semibold text-slate-600 hover:bg-slate-50 disabled:opacity-60"
                >
                  {isLoadingMore ? 'Loading the older month…' : 'Load the older month'}
                </button>
              </div>
            )}
            {!hasMore && !isLoadingMore && totals && groups.length > 0 && (
              <p className="mt-3 text-center text-[11px] text-slate-400">All {totals.orders} orders are shown.</p>
            )}

            {/* Summary */}
            <div className="mt-3 flex flex-wrap items-center justify-between gap-2 text-[11px] text-slate-500 px-1">
              <span>
                {totalOrders} order{totalOrders !== 1 ? 's' : ''} · {totals?.items ?? sales.length} item{(totals?.items ?? sales.length) !== 1 ? 's' : ''}
                {hasMore && <span className="text-slate-400"> · {groups.length} loaded</span>}
              </span>
              <span className="font-mono font-semibold">
                Total: <span className="text-slate-900">{formatPKR(totals?.sale ?? groups.reduce((a, g) => a + g.saleTotal, 0))}</span>
                {' · '}
                Profit:{' '}
                <span className={(totals?.profit ?? groups.reduce((a, g) => a + g.profit, 0)) >= 0 ? 'text-emerald-600' : 'text-rose-600'}>
                  {formatPKR(totals?.profit ?? groups.reduce((a, g) => a + g.profit, 0))}
                </span>
              </span>
            </div>
          </>
        )}
      </div>
    </div>
  )
}
