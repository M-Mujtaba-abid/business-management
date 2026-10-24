'use client'

import React, { useState, useEffect, useMemo } from 'react'
import { Search, Package, MapPin, Calendar, CheckCircle2, Clock, Banknote, SlidersHorizontal, ChevronDown, Camera } from 'lucide-react'
import StatusBadge from './ui/StatusBadge'
import CopyRef from './ui/CopyRef'
import { formatDateTime } from '@/lib/format'
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
  status: 'DISPATCHED' | 'DELIVERED' | 'RETURNED' | 'CANCELLED'
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
  paymentSource?: { id: string; name: string } | null
  orderSource?: { id: string; name: string } | null
  receivedBy?: { id: string; name: string } | null
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
      className={`px-2 py-0.5 rounded-full text-[10px] font-bold border inline-flex items-center gap-1 transition ${
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

export default function OrderList({
  sales,
  isLoading,
  searchQuery,
  setSearchQuery,
  statusFilter,
  setStatusFilter,
  startDate = '',
  setStartDate,
  endDate = '',
  setEndDate,
  setDateRange,
  filters,
  setFilters,
  onSetSupplierPayment,
  onSetCustomerPayment,
  onReceivePayment,
  onEditOrder,
  onSelectOrder,
}: OrderListProps) {
  const formatPKR = (amt: number) => `Rs. ${amt.toLocaleString()}`

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
    'w-full sm:w-auto bg-white border border-slate-300 rounded-xl px-2.5 py-2 sm:py-1.5 text-xs text-slate-800 focus:outline-none focus:border-emerald-500'

  return (
    <div className="bg-white border border-slate-200 rounded-2xl p-3 sm:p-6 shadow-sm space-y-4 sm:space-y-6">

      {/* Top Filter Bar */}
      <div className="flex flex-col lg:flex-row lg:items-center justify-between gap-4">

        {/* Status Filter Pills */}
        <div className="flex items-center gap-1.5 overflow-x-auto pb-1 sm:pb-0 -mx-3 px-3 sm:mx-0 sm:px-0">
          {[
            { label: 'All Orders', value: 'ALL' },
            { label: 'Dispatched', value: 'DISPATCHED' },
            { label: 'Delivered', value: 'DELIVERED' },
            { label: 'Returned', value: 'RETURNED' },
            { label: 'Cancelled', value: 'CANCELLED' },
          ].map((tab) => (
            <button
              key={tab.value}
              onClick={() => setStatusFilter(tab.value)}
              className={`px-3 py-1.5 rounded-xl text-xs font-semibold whitespace-nowrap transition ${
                statusFilter === tab.value
                  ? 'bg-emerald-500 text-white font-bold shadow-md shadow-emerald-500/10'
                  : 'bg-slate-100/80 text-slate-500 hover:text-slate-800 hover:bg-slate-100'
              }`}
            >
              {tab.label}
            </button>
          ))}
        </div>

        {/* Search & Custom Date Filters */}
        <div className="flex flex-wrap items-center gap-3 w-full lg:w-auto">

          {/* Start Date & End Date Pickers */}
          <div className="hidden sm:flex items-center gap-1.5 bg-white border border-slate-300 rounded-xl px-2.5 py-1 text-xs">
            <Calendar className="h-3.5 w-3.5 text-slate-500 shrink-0" />
            <span className="text-[10px] text-slate-500 font-semibold">From:</span>
            <input
              type="date"
              value={startDate}
              onChange={(e) => setStartDate && setStartDate(e.target.value)}
              className="bg-transparent text-[11px] text-emerald-600 font-mono focus:outline-none"
            />
            <span className="text-[10px] text-slate-500 font-semibold">To:</span>
            <input
              type="date"
              value={endDate}
              onChange={(e) => setEndDate && setEndDate(e.target.value)}
              className="bg-transparent text-[11px] text-emerald-600 font-mono focus:outline-none"
            />
            {(startDate || endDate) && (
              <button
                onClick={() => {
                  if (setStartDate) setStartDate('')
                  if (setEndDate) setEndDate('')
                  if (setDateRange) setDateRange('all')
                }}
                className="text-slate-500 hover:text-rose-600 text-xs ml-1 font-bold transition"
                title="Clear date filter"
              >
                ✕
              </button>
            )}
          </div>

          {/* Search Bar */}
          <div className="relative w-full sm:w-64 sm:flex-1">
            <Search className="absolute left-3 top-2.5 h-4 w-4 text-slate-500" />
            <input
              type="text"
              value={searchQuery}
              onChange={(e) => setSearchQuery(e.target.value)}
              placeholder="Search #, order ID, tracking, item..."
              className="w-full bg-white border border-slate-300 rounded-xl pl-9 pr-3 py-2 sm:py-1.5 text-xs text-slate-800 focus:outline-none focus:border-emerald-500 transition"
            />
          </div>

        </div>

      </div>

      {/* Filters toggle (phones) */}
      <button
        onClick={() => setShowFilters((v) => !v)}
        className={`sm:hidden w-full flex items-center justify-between px-3 py-2 rounded-xl border text-xs font-semibold ${
          hasFilters ? 'bg-emerald-50 border-emerald-200 text-emerald-700' : 'bg-white border-slate-200 text-slate-600'
        }`}
      >
        <span className="flex items-center gap-1.5">
          <SlidersHorizontal className="h-4 w-4" />
          Filters{hasFilters ? ` (${activeFilterCount})` : ''}
        </span>
        <ChevronDown className={`h-4 w-4 transition ${showFilters ? 'rotate-180' : ''}`} />
      </button>

      {/* Category / Supplier / Payment Filters */}
      <div className={`${showFilters ? 'grid' : 'hidden'} grid-cols-1 gap-2 sm:flex sm:flex-wrap sm:items-center`}>
        <select
          value={filters.orderSourceId}
          onChange={(e) => setFilters({ ...filters, orderSourceId: e.target.value })}
          className={selectClass}
        >
          <option value="">Order from: All</option>
          {orderSources.map((s) => (
            <option key={s.id} value={s.id}>Order from: {s.name}</option>
          ))}
          <option value="none">Order from: not set</option>
        </select>

        <select
          value={filters.categoryId}
          onChange={(e) => setFilters({ ...filters, categoryId: e.target.value })}
          className={selectClass}
        >
          <option value="">All categories</option>
          {categories.map((c) => (
            <option key={c.id} value={c.id}>{c.name}</option>
          ))}
        </select>

        <select
          value={filters.supplierId}
          onChange={(e) => setFilters({ ...filters, supplierId: e.target.value })}
          className={selectClass}
        >
          <option value="">All suppliers</option>
          {suppliers.map((s) => (
            <option key={s.id} value={s.id}>{s.name}</option>
          ))}
        </select>

        <select
          value={filters.supplierPayment}
          onChange={(e) => setFilters({ ...filters, supplierPayment: e.target.value })}
          className={selectClass}
        >
          <option value="">Supplier payment: All</option>
          <option value="PENDING">Supplier payment: Pending</option>
          <option value="PAID">Supplier payment: Paid</option>
        </select>

        <select
          value={filters.paymentSourceId}
          onChange={(e) => setFilters({ ...filters, paymentSourceId: e.target.value })}
          className={selectClass}
        >
          <option value="">All payment sources</option>
          {paymentSources.map((s) => (
            <option key={s.id} value={s.id}>{s.name}</option>
          ))}
          <option value="none">No source set</option>
        </select>

        <select
          value={filters.receivedById}
          onChange={(e) => setFilters({ ...filters, receivedById: e.target.value })}
          className={selectClass}
        >
          <option value="">Money goes to: All</option>
          {people.map((p) => (
            <option key={p.id} value={p.id}>Money goes to: {p.name}</option>
          ))}
          <option value="none">Money goes to: not set</option>
        </select>

        <select
          value={filters.paymentStatus}
          onChange={(e) => setFilters({ ...filters, paymentStatus: e.target.value })}
          className={selectClass}
        >
          <option value="">Payment: All</option>
          <option value="NOT_RECEIVED">Payment: Not received</option>
          <option value="RECEIVED">Payment: Received</option>
        </select>

        <button
          onClick={() =>
            filters.olderThanDays
              ? setFilters({ ...filters, olderThanDays: '' })
              : setFilters({ ...filters, supplierPayment: 'PENDING', olderThanDays: '15' })
          }
          className={`px-3 py-1.5 rounded-xl text-xs font-semibold border transition ${
            filters.olderThanDays
              ? 'bg-rose-500/20 text-rose-700 border-rose-500/40'
              : 'bg-slate-100/80 text-slate-500 border-slate-300/80 hover:text-slate-800'
          }`}
        >
          Supplier pending 15+ days
        </button>

        <button
          onClick={() => setFilters({ ...filters, missingRef: filters.missingRef ? '' : '1' })}
          className={`px-3 py-1.5 rounded-xl text-xs font-semibold border transition ${
            filters.missingRef
              ? 'bg-blue-500/15 text-blue-700 border-blue-500/40'
              : 'bg-slate-100/80 text-slate-500 border-slate-300/80 hover:text-slate-800'
          }`}
        >
          Missing tracking / ID
        </button>

        {hasFilters && (
          <button
            onClick={() => setFilters(EMPTY_ORDER_FILTERS)}
            className="text-xs text-slate-500 hover:text-rose-600 font-semibold"
          >
            Clear filters ✕
          </button>
        )}
      </div>

      {/* Bulk action bar */}
      {selectedIds.length > 0 && (
        <div className="sticky bottom-3 z-20 lg:static flex flex-wrap items-center justify-between gap-2 bg-emerald-50 border border-emerald-200 rounded-xl px-3 sm:px-4 py-2.5 text-xs shadow-lg lg:shadow-none">
          <span className="text-emerald-700 font-semibold">
            {groups.filter((g) => g.ids.some((id) => selectedIds.includes(id))).length} order(s) selected · to receive {formatPKR(selectedToReceive)} · owed to supplier{' '}
            {formatPKR(selectedOwedToSupplier)}
          </span>
          <div className="grid grid-cols-3 sm:flex sm:flex-wrap gap-2 w-full sm:w-auto">
            <button
              onClick={() => setSelectedIds([])}
              className="px-3 py-2 sm:py-1 rounded-lg bg-white border border-slate-200 text-slate-700 font-semibold"
            >
              Clear
            </button>
            <button
              onClick={() => runBulk(() => onSetCustomerPayment(selectedIds, 'RECEIVED'))}
              disabled={isBulkUpdating}
              className="px-3 py-2 sm:py-1 rounded-lg bg-emerald-500 text-white font-bold disabled:opacity-50"
            >
              {isBulkUpdating ? 'Updating...' : 'Payment Received'}
            </button>
            <button
              onClick={() => runBulk(() => onSetSupplierPayment(selectedIds, 'PAID'))}
              disabled={isBulkUpdating}
              className="px-3 py-2 sm:py-1 rounded-lg bg-amber-500 text-white font-bold disabled:opacity-50"
            >
              {isBulkUpdating ? 'Updating...' : 'Supplier Paid'}
            </button>
          </div>
        </div>
      )}

      {/* Orders List Table */}
      {isLoading ? (
        <div className="space-y-3">
          {[...Array(5)].map((_, i) => (
            <div key={i} className="h-16 bg-slate-100/40 rounded-xl animate-pulse" />
          ))}
        </div>
      ) : sales.length === 0 ? (
        <div className="p-12 text-center border border-dashed border-slate-200 rounded-xl bg-white/40">
          <Package className="h-10 w-10 text-slate-400 mx-auto mb-3" />
          <p className="text-slate-500 font-medium text-sm">No sales records found</p>
          <p className="text-slate-500 text-xs mt-1">Try adjusting your filters or search term.</p>
        </div>
      ) : (
        <>
        {/* Phones & tablets: one card per order / parcel */}
        <div className="lg:hidden space-y-3">
          <label className="flex items-center gap-2 text-xs text-slate-500 px-1">
            <input
              type="checkbox"
              checked={allSelected}
              onChange={() => setSelectedIds(allSelected ? [] : sales.map((s) => s.id))}
              className="h-4 w-4 accent-emerald-500"
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
                className={`rounded-xl border p-3 space-y-2.5 active:bg-slate-50 transition cursor-pointer ${
                  isSelected ? 'border-emerald-300 bg-emerald-50/40' : 'border-slate-200 bg-white'
                }`}
              >
                <div className="flex items-start gap-2.5">
                  <input
                    type="checkbox"
                    checked={isSelected}
                    onClick={(e) => e.stopPropagation()}
                    onChange={() => toggleGroup(g)}
                    className="h-4 w-4 mt-0.5 accent-emerald-500 shrink-0"
                  />
                  <div className="min-w-0 flex-1">
                    <div className="flex items-start justify-between gap-2">
                      <div className="min-w-0">
                        <div className="flex items-center gap-1 mb-0.5">
                          {sale.orderNo && <span className="text-[11px] font-bold text-slate-500 font-mono">#{sale.orderNo}</span>}
                          {!!sale.imageCount && (
                            <span className="inline-flex items-center gap-0.5 text-[10px] font-semibold text-violet-700" title={`${sale.imageCount} photo(s)`}>
                              <Camera className="h-3 w-3" />{sale.imageCount}
                            </span>
                          )}
                          {g.items.length > 1 && (
                            <span className="inline-block px-1.5 py-px rounded bg-slate-900 text-white text-[10px] font-bold">
                              {g.items.length} items
                            </span>
                          )}
                        </div>
                        <div className="font-semibold text-sm text-slate-900 break-words">{groupTitle(g)}</div>
                        {(sale.externalOrderId || sale.trackingNumber) && (
                          <div className="flex flex-wrap gap-x-2 mt-0.5" onClick={(e) => e.stopPropagation()}>
                            {sale.externalOrderId && <CopyRef label={sale.orderSource?.name || 'Order ID'} value={sale.externalOrderId} />}
                            {sale.trackingNumber && <CopyRef label="TRK" value={sale.trackingNumber} />}
                          </div>
                        )}
                      </div>
                      <div className="text-right shrink-0">
                        <div className="text-sm font-bold text-emerald-600 font-mono">{formatPKR(g.saleTotal)}</div>
                        <div className="text-[11px] text-slate-500 font-mono">Profit {formatPKR(g.profit)}</div>
                        <button
                          type="button"
                          onClick={(e) => {
                            e.stopPropagation()
                            onEditOrder(g.items)
                          }}
                          className="mt-1 px-2 py-0.5 rounded-md bg-blue-50 border border-blue-200 text-blue-700 text-[11px] font-semibold"
                        >
                          Edit
                        </button>
                      </div>
                    </div>
                    <div className="flex flex-wrap items-center gap-x-1.5 gap-y-1 text-[11px] text-slate-500 mt-1">
                      {sale.orderSource?.name && (
                        <span className="px-1.5 py-px rounded bg-violet-50 text-violet-700 border border-violet-100 font-semibold">
                          {sale.orderSource.name}
                        </span>
                      )}
                      {g.items.length === 1 && sale.category?.name && <span className="text-sky-600">{sale.category.name}</span>}
                      {g.items.length === 1 && <span>Qty {sale.quantity}</span>}
                      <span>· {formatDateTime(sale.createdAt, true)}</span>
                    </div>
                    {(sale.customerName !== 'Walk-in' || sale.city !== 'General') && (
                      <div className="flex items-center gap-1 text-[11px] text-slate-500 mt-0.5">
                        <MapPin className="h-3 w-3 text-emerald-600 shrink-0" />
                        <span className="truncate">{sale.customerName}{sale.city !== 'General' ? `, ${sale.city}` : ''}{sale.customerPhone ? ` · ${sale.customerPhone}` : ''}</span>
                      </div>
                    )}
                  </div>
                </div>

                <div className="grid grid-cols-3 gap-2 text-[10px] text-slate-500 border-t border-slate-100 pt-2" onClick={(e) => e.stopPropagation()}>
                  <div className="space-y-1 min-w-0">
                    <div>Order</div>
                    <StatusBadge status={sale.status} />
                  </div>
                  <div className="space-y-1 min-w-0">
                    <div className="truncate">
                      {sale.paymentSource?.name || 'Payment'}
                      {sale.receivedBy?.name ? ` → ${sale.receivedBy.name}` : ''}
                    </div>
                    <PaymentBadge status={sale.paymentStatus} onClick={() => togglePayment(g)} />
                  </div>
                  <div className="space-y-1 min-w-0">
                    <div className="truncate">{g.supplierNames.join(', ') || 'Supplier'}</div>
                    <GroupSupplierBadge g={g} onClick={() => toggleSupplier(g)} />
                  </div>
                </div>
              </div>
            )
          })}
        </div>

        {/* Desktop: full table */}
        <div className="hidden lg:block overflow-x-auto">
          <table className="w-full text-left text-xs text-slate-700">
            <thead className="bg-slate-50/60 text-slate-500 uppercase tracking-wider font-semibold border-b border-slate-200">
              <tr>
                <th className="pl-4 py-3 w-8">
                  <input
                    type="checkbox"
                    checked={allSelected}
                    onChange={() => setSelectedIds(allSelected ? [] : sales.map((s) => s.id))}
                    title="Select all orders"
                    className="h-3.5 w-3.5 accent-emerald-500"
                  />
                </th>
                <th className="px-4 py-3">Order Item</th>
                <th className="px-4 py-3">Supplier</th>
                <th className="px-4 py-3">Total Amount</th>
                <th className="px-4 py-3">Status</th>
                <th className="px-4 py-3">Payment</th>
                <th className="px-4 py-3">Supplier Pay</th>
                <th className="px-4 py-3">Added</th>
                <th className="px-4 py-3 text-right">Actions</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-slate-100/60">
              {groups.map((g) => {
                const sale = g.lead
                return (
                  <tr
                    key={g.key}
                    onClick={() => onSelectOrder(sale)}
                    className="hover:bg-slate-100/40 transition cursor-pointer align-top"
                  >
                    {/* Select for bulk payment updates */}
                    <td className="pl-4 py-3.5" onClick={(e) => e.stopPropagation()}>
                      <input
                        type="checkbox"
                        checked={g.ids.every((id) => selectedIds.includes(id))}
                        onChange={() => toggleGroup(g)}
                        className="h-3.5 w-3.5 accent-emerald-500"
                      />
                    </td>

                    {/* Order Item(s) */}
                    <td className="px-4 py-3.5 max-w-[280px]">
                      <div className="font-semibold text-slate-900 flex items-center gap-1.5">
                        {sale.orderNo && <span className="text-[11px] font-bold text-slate-500 font-mono shrink-0">#{sale.orderNo}</span>}
                        {!!sale.imageCount && (
                          <span className="inline-flex items-center gap-0.5 text-[10px] font-semibold text-violet-700 shrink-0" title={`${sale.imageCount} photo(s)`}>
                            <Camera className="h-3 w-3" />{sale.imageCount}
                          </span>
                        )}
                        {g.items.length > 1 && (
                          <span className="px-1.5 py-px rounded bg-slate-900 text-white text-[10px] font-bold shrink-0">
                            {g.items.length} items
                          </span>
                        )}
                        <span className="truncate">{groupTitle(g)}</span>
                      </div>
                      {(sale.externalOrderId || sale.trackingNumber) && (
                        <div className="flex flex-wrap gap-x-2 mt-0.5" onClick={(e) => e.stopPropagation()}>
                          {sale.externalOrderId && <CopyRef label={sale.orderSource?.name || 'Order ID'} value={sale.externalOrderId} />}
                          {sale.trackingNumber && <CopyRef label="TRK" value={sale.trackingNumber} />}
                        </div>
                      )}
                      <div className="text-[11px] text-slate-500">
                        {sale.orderSource?.name && (
                          <span className="inline-block mr-1 px-1.5 py-px rounded bg-violet-50 text-violet-700 border border-violet-100 font-semibold">
                            {sale.orderSource.name}
                          </span>
                        )}
                        {g.items.length === 1 ? (
                          <>
                            {sale.category?.name && <span className="text-sky-600">{sale.category.name} · </span>}
                            <span className="font-mono">Qty: {sale.quantity}</span>
                          </>
                        ) : (
                          <span>{g.items.map((i) => `${i.productName} ×${i.quantity}`).join(' · ')}</span>
                        )}
                      </div>
                      {(sale.customerName !== 'Walk-in' || sale.city !== 'General') && (
                        <div className="flex items-center gap-1 text-[11px] text-slate-500 mt-0.5">
                          <MapPin className="h-3 w-3 text-emerald-600 shrink-0" />
                          <span>{sale.customerName}{sale.city !== 'General' ? `, ${sale.city}` : ''}{sale.customerPhone ? ` · ${sale.customerPhone}` : ''}</span>
                        </div>
                      )}
                    </td>

                    {/* Supplier(s) */}
                    <td className="px-4 py-3.5 text-slate-700">
                      {g.supplierNames.length ? g.supplierNames.join(', ') : '—'}
                    </td>

                    {/* Pricing */}
                    <td className="px-4 py-3.5 font-mono">
                      <div className="text-emerald-600 font-bold">{formatPKR(g.saleTotal)}</div>
                      <div className="text-slate-500 text-[11px]">Profit: {formatPKR(g.profit)}</div>
                    </td>

                    {/* Status Badge */}
                    <td className="px-4 py-3.5">
                      <StatusBadge status={sale.status} />
                    </td>

                    {/* Payment from Daraz / courier / other */}
                    <td className="px-4 py-3.5" onClick={(e) => e.stopPropagation()}>
                      <div className="text-[11px] text-slate-600 mb-1 whitespace-nowrap">
                        {sale.paymentSource?.name || '—'}
                        {sale.receivedBy?.name && <span className="text-slate-500"> → <b className="text-slate-700">{sale.receivedBy.name}</b></span>}
                      </div>
                      <PaymentBadge status={sale.paymentStatus} onClick={() => togglePayment(g)} />
                    </td>

                    {/* Supplier payment */}
                    <td className="px-4 py-3.5" onClick={(e) => e.stopPropagation()}>
                      <GroupSupplierBadge g={g} onClick={() => toggleSupplier(g)} />
                    </td>

                    {/* Date */}
                    <td className="px-4 py-3.5 text-slate-500 text-[11px] whitespace-nowrap">
                      <div>{new Date(sale.createdAt).toLocaleDateString('en-GB', { day: 'numeric', month: 'short', year: 'numeric' })}</div>
                      <div className="text-slate-400">{new Date(sale.createdAt).toLocaleTimeString('en-US', { hour: 'numeric', minute: '2-digit', hour12: true })}</div>
                    </td>

                    {/* Action Buttons */}
                    <td className="px-4 py-3.5 text-right whitespace-nowrap" onClick={(e) => e.stopPropagation()}>
                      <button
                        onClick={() => onEditOrder(g.items)}
                        className="px-3 py-1 mr-1.5 bg-blue-50 hover:bg-blue-100 border border-blue-200 text-blue-700 rounded-lg text-xs font-semibold transition"
                      >
                        Edit
                      </button>
                      <button
                        onClick={() => onSelectOrder(sale)}
                        className="px-3 py-1 bg-slate-100 hover:bg-slate-200 text-slate-700 rounded-lg text-xs font-semibold transition"
                      >
                        View
                      </button>
                    </td>
                  </tr>
                )
              })}
            </tbody>
          </table>
        </div>
        </>
      )}

    </div>
  )
}
