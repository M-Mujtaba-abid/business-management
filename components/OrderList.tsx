'use client'

import React from 'react'
import { Search, Package, MapPin, Calendar } from 'lucide-react'
import StatusBadge from './ui/StatusBadge'

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
  profit: number
  status: 'DISPATCHED' | 'DELIVERED' | 'RETURNED' | 'CANCELLED'
  deductDeliveryOnReturn: boolean
  createdAt: string
  product?: {
    name: string
  }
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
  onSelectOrder: (sale: Sale) => void
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
  onSelectOrder,
}: OrderListProps) {
  const formatPKR = (amt: number) => `Rs. ${amt.toLocaleString()}`

  return (
    <div className="bg-slate-900 border border-slate-800 rounded-2xl p-4 sm:p-6 shadow-xl space-y-6">
      
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
                  ? 'bg-emerald-500 text-slate-950 font-bold shadow-md shadow-emerald-500/10'
                  : 'bg-slate-800/80 text-slate-400 hover:text-slate-200 hover:bg-slate-800'
              }`}
            >
              {tab.label}
            </button>
          ))}
        </div>

        {/* Search & Custom Date Filters */}
        <div className="flex flex-wrap items-center gap-3 w-full lg:w-auto">
          
          {/* Start Date & End Date Pickers */}
          <div className="flex items-center gap-1.5 bg-slate-800/80 border border-slate-700/80 rounded-xl px-2.5 py-1 text-xs">
            <Calendar className="h-3.5 w-3.5 text-slate-400 shrink-0" />
            <span className="text-[10px] text-slate-400 font-semibold">From:</span>
            <input
              type="date"
              value={startDate}
              onChange={(e) => setStartDate && setStartDate(e.target.value)}
              className="bg-transparent text-[11px] text-emerald-400 font-mono focus:outline-none [color-scheme:dark]"
            />
            <span className="text-[10px] text-slate-400 font-semibold">To:</span>
            <input
              type="date"
              value={endDate}
              onChange={(e) => setEndDate && setEndDate(e.target.value)}
              className="bg-transparent text-[11px] text-emerald-400 font-mono focus:outline-none [color-scheme:dark]"
            />
            {(startDate || endDate) && (
              <button
                onClick={() => {
                  if (setStartDate) setStartDate('')
                  if (setEndDate) setEndDate('')
                  if (setDateRange) setDateRange('all')
                }}
                className="text-slate-400 hover:text-rose-400 text-xs ml-1 font-bold transition"
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
              placeholder="Search customer, city, item..."
              className="w-full bg-slate-800 border border-slate-700 rounded-xl pl-9 pr-3 py-1.5 text-xs text-slate-200 focus:outline-none focus:border-emerald-500 transition"
            />
          </div>

        </div>

      </div>

      {/* Orders List Table */}
      {isLoading ? (
        <div className="space-y-3">
          {[...Array(5)].map((_, i) => (
            <div key={i} className="h-16 bg-slate-800/40 rounded-xl animate-pulse" />
          ))}
        </div>
      ) : sales.length === 0 ? (
        <div className="p-12 text-center border border-dashed border-slate-800 rounded-xl bg-slate-900/40">
          <Package className="h-10 w-10 text-slate-600 mx-auto mb-3" />
          <p className="text-slate-400 font-medium text-sm">No sales records found</p>
          <p className="text-slate-500 text-xs mt-1">Try adjusting your status filter or search term.</p>
        </div>
      ) : (
        <div className="overflow-x-auto">
          <table className="w-full text-left text-xs text-slate-300">
            <thead className="bg-slate-950/60 text-slate-400 uppercase tracking-wider font-semibold border-b border-slate-800">
              <tr>
                <th className="px-4 py-3">Order Item</th>
                <th className="px-4 py-3">Customer & City</th>
                <th className="px-4 py-3">Total Amount</th>
                <th className="px-4 py-3">Status</th>
                <th className="px-4 py-3">Date</th>
                <th className="px-4 py-3 text-right">Actions</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-slate-800/60">
              {sales.map((sale) => (
                <tr
                  key={sale.id}
                  onClick={() => onSelectOrder(sale)}
                  className="hover:bg-slate-800/40 transition cursor-pointer"
                >
                  {/* Order Item */}
                  <td className="px-4 py-3.5">
                    <div className="font-semibold text-slate-100">{sale.productName}</div>
                    <div className="text-[11px] text-slate-400 font-mono">Qty: {sale.quantity}</div>
                  </td>

                  {/* Customer Info */}
                  <td className="px-4 py-3.5">
                    <div className="font-medium text-slate-200">{sale.customerName}</div>
                    <div className="flex items-center gap-1 text-[11px] text-slate-400 mt-0.5">
                      <MapPin className="h-3 w-3 text-emerald-400 shrink-0" />
                      <span>{sale.city}</span>
                    </div>
                  </td>

                  {/* Pricing */}
                  <td className="px-4 py-3.5 font-mono">
                    <div className="text-emerald-400 font-bold">{formatPKR(sale.soldPrice * sale.quantity)}</div>
                    <div className="text-slate-500 text-[11px]">Profit: {formatPKR(sale.profit)}</div>
                  </td>

                  {/* Status Badge */}
                  <td className="px-4 py-3.5">
                    <StatusBadge status={sale.status} />
                  </td>

                  {/* Date */}
                  <td className="px-4 py-3.5 font-mono text-slate-400 text-[11px]">
                    {new Date(sale.createdAt).toLocaleDateString()}
                  </td>

                  {/* Action Buttons */}
                  <td className="px-4 py-3.5 text-right" onClick={(e) => e.stopPropagation()}>
                    <button
                      onClick={() => onSelectOrder(sale)}
                      className="px-3 py-1 bg-slate-800 hover:bg-slate-700 text-slate-300 rounded-lg text-xs font-semibold transition"
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
