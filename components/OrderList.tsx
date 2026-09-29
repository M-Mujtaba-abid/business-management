'use client'

import React, { useState, useEffect } from 'react'
import { Search, Package, MapPin, Calendar, CheckCircle2, Clock, Banknote } from 'lucide-react'
import StatusBadge from './ui/StatusBadge'

export type SupplierPaymentStatus = 'PENDING' | 'PAID' | 'NOT_APPLICABLE'
export type CustomerPaymentStatus = 'NOT_RECEIVED' | 'RECEIVED' | 'NOT_APPLICABLE'

export interface Sale {
  id: string
  productName: string
  customerName: string
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
  paymentSource?: { id: string; name: string } | null
  orderSource?: { id: string; name: string } | null
  receivedBy?: { id: string; name: string } | null
}

export interface OrderFilters {
  receivedById: string // '' | person id | 'none'
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
    .reduce((acc, s) => acc + s.soldPrice * s.quantity, 0)
  const selectedOwedToSupplier = selectedSales
    .filter((s) => s.supplierPaymentStatus === 'PENDING')
    .reduce((acc, s) => acc + s.costPrice * s.quantity, 0)

  const toggleSelected = (id: string) =>
    setSelectedIds((prev) => (prev.includes(id) ? prev.filter((x) => x !== id) : [...prev, id]))

  const runBulk = async (action: () => Promise<void>) => {
    setIsBulkUpdating(true)
    try {
      await action()
      setSelectedIds([])
    } finally {
      setIsBulkUpdating(false)
    }
  }

  const hasFilters = Object.values(filters).some(Boolean)

  const selectClass =
    'bg-white border border-slate-300 rounded-xl px-2.5 py-1.5 text-xs text-slate-800 focus:outline-none focus:border-emerald-500'

  return (
    <div className="bg-white border border-slate-200 rounded-2xl p-4 sm:p-6 shadow-sm space-y-6">

      {/* Top Filter Bar */}
      <div className="flex flex-col lg:flex-row lg:items-center justify-between gap-4">

        {/* Status Filter Pills */}
        <div className="flex items-center gap-1.5 overflow-x-auto pb-1 sm:pb-0">
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
          <div className="flex items-center gap-1.5 bg-white border border-slate-300 rounded-xl px-2.5 py-1 text-xs">
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
          <div className="relative flex-1 sm:w-64">
            <Search className="absolute left-3 top-2.5 h-4 w-4 text-slate-500" />
            <input
              type="text"
              value={searchQuery}
              onChange={(e) => setSearchQuery(e.target.value)}
              placeholder="Search customer, city, item, supplier..."
              className="w-full bg-white border border-slate-300 rounded-xl pl-9 pr-3 py-1.5 text-xs text-slate-800 focus:outline-none focus:border-emerald-500 transition"
            />
          </div>

        </div>

      </div>

      {/* Category / Supplier / Payment Filters */}
      <div className="flex flex-wrap items-center gap-2">
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
        <div className="flex flex-wrap items-center justify-between gap-2 bg-emerald-500/10 border border-emerald-500/30 rounded-xl px-4 py-2.5 text-xs">
          <span className="text-emerald-700 font-semibold">
            {selectedIds.length} order(s) selected · to receive {formatPKR(selectedToReceive)} · owed to supplier{' '}
            {formatPKR(selectedOwedToSupplier)}
          </span>
          <div className="flex flex-wrap gap-2">
            <button
              onClick={() => setSelectedIds([])}
              className="px-3 py-1 rounded-lg bg-slate-100 text-slate-700 font-semibold"
            >
              Clear
            </button>
            <button
              onClick={() => runBulk(() => onSetCustomerPayment(selectedIds, 'RECEIVED'))}
              disabled={isBulkUpdating}
              className="px-3 py-1 rounded-lg bg-emerald-500 text-white font-bold disabled:opacity-50"
            >
              {isBulkUpdating ? 'Updating...' : 'Payment Received'}
            </button>
            <button
              onClick={() => runBulk(() => onSetSupplierPayment(selectedIds, 'PAID'))}
              disabled={isBulkUpdating}
              className="px-3 py-1 rounded-lg bg-amber-500 text-white font-bold disabled:opacity-50"
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
        <div className="overflow-x-auto">
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
                <th className="px-4 py-3">Date</th>
                <th className="px-4 py-3 text-right">Actions</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-slate-100/60">
              {sales.map((sale) => (
                <tr
                  key={sale.id}
                  onClick={() => onSelectOrder(sale)}
                  className="hover:bg-slate-100/40 transition cursor-pointer"
                >
                  {/* Select for bulk payment updates */}
                  <td className="pl-4 py-3.5" onClick={(e) => e.stopPropagation()}>
                    <input
                      type="checkbox"
                      checked={selectedIds.includes(sale.id)}
                      onChange={() => toggleSelected(sale.id)}
                      className="h-3.5 w-3.5 accent-emerald-500"
                    />
                  </td>

                  {/* Order Item */}
                  <td className="px-4 py-3.5">
                    <div className="font-semibold text-slate-900">{sale.productName}</div>
                    <div className="text-[11px] text-slate-500">
                      {sale.orderSource?.name && (
                        <span className="inline-block mr-1 px-1.5 py-px rounded bg-violet-50 text-violet-700 border border-violet-100 font-semibold">
                          {sale.orderSource.name}
                        </span>
                      )}
                      {sale.category?.name && <span className="text-sky-600">{sale.category.name} · </span>}
                      <span className="font-mono">Qty: {sale.quantity}</span>
                    </div>
                    {(sale.customerName !== 'Walk-in' || sale.city !== 'General') && (
                      <div className="flex items-center gap-1 text-[11px] text-slate-500 mt-0.5">
                        <MapPin className="h-3 w-3 text-emerald-600 shrink-0" />
                        <span>{sale.customerName}{sale.city !== 'General' ? `, ${sale.city}` : ''}</span>
                      </div>
                    )}
                  </td>

                  {/* Supplier */}
                  <td className="px-4 py-3.5 text-slate-700">
                    {sale.supplier?.name || (sale.returnedItemId ? <span className="text-emerald-600">♻ Returned stock</span> : '—')}
                  </td>

                  {/* Pricing */}
                  <td className="px-4 py-3.5 font-mono">
                    <div className="text-emerald-600 font-bold">{formatPKR(sale.soldPrice * sale.quantity)}</div>
                    <div className="text-slate-500 text-[11px]">Profit: {formatPKR(sale.profit)}</div>
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
                    <PaymentBadge
                      status={sale.paymentStatus}
                      onClick={() =>
                        onSetCustomerPayment([sale.id], sale.paymentStatus === 'RECEIVED' ? 'NOT_RECEIVED' : 'RECEIVED')
                      }
                    />
                  </td>

                  {/* Supplier payment */}
                  <td className="px-4 py-3.5" onClick={(e) => e.stopPropagation()}>
                    <SupplierPayBadge
                      status={sale.supplierPaymentStatus}
                      onClick={() =>
                        onSetSupplierPayment([sale.id], sale.supplierPaymentStatus === 'PAID' ? 'PENDING' : 'PAID')
                      }
                    />
                  </td>

                  {/* Date */}
                  <td className="px-4 py-3.5 font-mono text-slate-500 text-[11px]">
                    {new Date(sale.createdAt).toLocaleDateString()}
                  </td>

                  {/* Action Buttons */}
                  <td className="px-4 py-3.5 text-right" onClick={(e) => e.stopPropagation()}>
                    <button
                      onClick={() => onSelectOrder(sale)}
                      className="px-3 py-1 bg-slate-100 hover:bg-slate-200 text-slate-700 rounded-lg text-xs font-semibold transition"
                    >
                      View Details
                    </button>
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      )}

    </div>
  )
}
