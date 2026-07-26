'use client'

import React from 'react'
import {
  Search,
  CheckCircle2,
  RotateCcw,
  XCircle,
  Trash2,
  Package,
  MapPin,
  Truck,
} from 'lucide-react'

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
  onUpdateStatus: (id: string, status: string) => void
  onOpenReturnModal: (sale: Sale) => void
  onDeleteSale: (id: string) => void
}

export default function OrderList({
  sales,
  isLoading,
  searchQuery,
  setSearchQuery,
  statusFilter,
  setStatusFilter,
  onUpdateStatus,
  onOpenReturnModal,
  onDeleteSale,
}: OrderListProps) {
  const getStatusBadge = (status: string) => {
    switch (status) {
      case 'DELIVERED':
        return (
          <span className="inline-flex items-center gap-1 px-2.5 py-0.5 rounded-full text-xs font-semibold bg-emerald-500/10 text-emerald-400 border border-emerald-500/20">
            <CheckCircle2 className="h-3 w-3" /> Delivered
          </span>
        )
      case 'RETURNED':
        return (
          <span className="inline-flex items-center gap-1 px-2.5 py-0.5 rounded-full text-xs font-semibold bg-rose-500/10 text-rose-400 border border-rose-500/20">
            <RotateCcw className="h-3 w-3" /> Returned
          </span>
        )
      case 'CANCELLED':
        return (
          <span className="inline-flex items-center gap-1 px-2.5 py-0.5 rounded-full text-xs font-semibold bg-slate-800 text-slate-400 border border-slate-700">
            <XCircle className="h-3 w-3" /> Cancelled
          </span>
        )
      default:
        return (
          <span className="inline-flex items-center gap-1 px-2.5 py-0.5 rounded-full text-xs font-semibold bg-amber-500/10 text-amber-400 border border-amber-500/20 animate-pulse">
            <Truck className="h-3 w-3" /> Dispatched
          </span>
        )
    }
  }

  const formatPKR = (amt: number) => {
    return `Rs. ${amt.toLocaleString()}`
  }

  return (
    <div className="bg-slate-900 border border-slate-800 rounded-2xl p-4 sm:p-6 shadow-xl">
      
      {/* Top Filter Bar */}
      <div className="flex flex-col md:flex-row md:items-center justify-between gap-4 mb-6">
        
        {/* Status Filter Badges */}
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
              className={`px-3 py-1.5 rounded-lg text-xs font-medium whitespace-nowrap transition ${
                statusFilter === tab.value
                  ? 'bg-emerald-500 text-slate-950 font-bold shadow-md shadow-emerald-500/10'
                  : 'bg-slate-800/80 text-slate-400 hover:text-slate-200 hover:bg-slate-800'
              }`}
            >
              {tab.label}
            </button>
          ))}
        </div>

        {/* Search Bar */}
        <div className="relative w-full md:w-72">
          <Search className="absolute left-3 top-2.5 h-4 w-4 text-slate-500" />
          <input
            type="text"
            value={searchQuery}
            onChange={(e) => setSearchQuery(e.target.value)}
            placeholder="Search customer, city, product..."
            className="w-full bg-slate-800 border border-slate-700 rounded-xl pl-9 pr-3 py-1.5 text-xs text-slate-200 focus:outline-none focus:border-emerald-500 transition"
          />
        </div>

      </div>

      {/* Orders List Table / Cards */}
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
                <th className="px-4 py-3">Customer & Address</th>
                <th className="px-4 py-3">Product & Qty</th>
                <th className="px-4 py-3">Pricing (Cost / Sold)</th>
                <th className="px-4 py-3">Delivery Fee</th>
                <th className="px-4 py-3">Realized Profit</th>
                <th className="px-4 py-3">Status</th>
                <th className="px-4 py-3 text-right">Actions</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-slate-800/60">
              {sales.map((sale) => (
                <tr key={sale.id} className="hover:bg-slate-800/40 transition">
                  {/* Customer Info */}
                  <td className="px-4 py-3.5">
                    <div className="font-semibold text-slate-100">{sale.customerName}</div>
                    <div className="flex items-center gap-1 text-[11px] text-slate-400 mt-0.5">
                      <MapPin className="h-3 w-3 text-emerald-400 shrink-0" />
                      <span>{sale.city} — <span className="text-slate-500">{sale.address}</span></span>
                    </div>
                  </td>

                  {/* Product Info */}
                  <td className="px-4 py-3.5">
                    <div className="font-medium text-slate-200">{sale.productName}</div>
                    <span className="text-[11px] text-slate-400 font-mono">Qty: {sale.quantity}</span>
                  </td>

                  {/* Pricing */}
                  <td className="px-4 py-3.5 font-mono">
                    <div className="text-emerald-400 font-medium">Sold: {formatPKR(sale.soldPrice * sale.quantity)}</div>
                    <div className="text-slate-500 text-[11px]">Cost: {formatPKR(sale.costPrice * sale.quantity)}</div>
                  </td>

                  {/* Delivery Charge */}
                  <td className="px-4 py-3.5 font-mono text-slate-400">
                    {formatPKR(sale.deliveryCharge)}
                  </td>

                  {/* Profit */}
                  <td className="px-4 py-3.5 font-mono font-bold">
                    {sale.status === 'DELIVERED' ? (
                      <span className="text-emerald-400">+{formatPKR(sale.profit)}</span>
                    ) : sale.status === 'RETURNED' ? (
                      <span className="text-rose-400">
                        {sale.profit < 0 ? formatPKR(sale.profit) : 'Rs. 0'}
                      </span>
                    ) : (
                      <span className="text-slate-500">Pending</span>
                    )}
                  </td>

                  {/* Status Badge */}
                  <td className="px-4 py-3.5">
                    {getStatusBadge(sale.status)}
                  </td>

                  {/* Action Buttons */}
                  <td className="px-4 py-3.5 text-right">
                    <div className="flex items-center justify-end gap-1">
                      {sale.status !== 'DELIVERED' && (
                        <button
                          onClick={() => onUpdateStatus(sale.id, 'DELIVERED')}
                          title="Mark Delivered"
                          className="px-2 py-1 bg-emerald-500/10 hover:bg-emerald-500/20 text-emerald-400 rounded-md font-semibold text-[11px] transition border border-emerald-500/20"
                        >
                          Delivered
                        </button>
                      )}

                      {sale.status !== 'RETURNED' && (
                        <button
                          onClick={() => onOpenReturnModal(sale)}
                          title="Mark Returned"
                          className="px-2 py-1 bg-rose-500/10 hover:bg-rose-500/20 text-rose-400 rounded-md font-semibold text-[11px] transition border border-rose-500/20"
                        >
                          Returned
                        </button>
                      )}

                      {sale.status === 'DISPATCHED' && (
                        <button
                          onClick={() => onUpdateStatus(sale.id, 'CANCELLED')}
                          title="Cancel Order"
                          className="px-2 py-1 bg-slate-800 hover:bg-slate-700 text-slate-400 rounded-md text-[11px] transition"
                        >
                          Cancel
                        </button>
                      )}

                      <button
                        onClick={() => onDeleteSale(sale.id)}
                        title="Delete Sale"
                        className="p-1 text-slate-500 hover:text-rose-400 hover:bg-rose-500/10 rounded-md transition ml-1"
                      >
                        <Trash2 className="h-3.5 w-3.5" />
                      </button>
                    </div>
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
