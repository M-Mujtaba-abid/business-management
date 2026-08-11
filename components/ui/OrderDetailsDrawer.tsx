'use client'

import React from 'react'
import { X, MapPin, Package, DollarSign, Trash2, CheckCircle2, RotateCcw, XCircle } from 'lucide-react'
import StatusBadge from './StatusBadge'

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

interface OrderDetailsDrawerProps {
  sale: Sale | null
  isOpen: boolean
  onClose: () => void
  onUpdateStatus: (id: string, status: string, deductDeliveryOnReturn?: boolean) => void
  onOpenReturnModal: (sale: Sale) => void
  onDeleteSale: (id: string) => void
}

export default function OrderDetailsDrawer({
  sale,
  isOpen,
  onClose,
  onUpdateStatus,
  onOpenReturnModal,
  onDeleteSale,
}: OrderDetailsDrawerProps) {
  if (!isOpen || !sale) return null

  const formatPKR = (amt: number) => `Rs. ${amt.toLocaleString()}`

  return (
    <div className="fixed inset-0 z-50 overflow-hidden bg-slate-950/70 backdrop-blur-sm animate-in fade-in">
      <div className="absolute inset-0" onClick={onClose} />

      <aside className="absolute inset-y-0 right-0 max-w-full flex pl-10">
        <div className="w-screen max-w-md bg-slate-900 border-l border-slate-800 text-slate-100 shadow-2xl flex flex-col justify-between">
          
          {/* Top Bar */}
          <div className="p-6 border-b border-slate-800 flex items-center justify-between bg-slate-900/50">
            <div>
              <div className="flex items-center gap-2">
                <span className="text-xs font-mono text-slate-500 uppercase">Order Details</span>
                <StatusBadge status={sale.status} />
              </div>
              <h2 className="text-lg font-bold text-slate-100 mt-1">{sale.productName}</h2>
            </div>
            <button
              onClick={onClose}
              className="p-1 rounded-lg text-slate-400 hover:text-white hover:bg-slate-800 transition"
            >
              <X className="h-5 w-5" />
            </button>
          </div>

          {/* Drawer Body Details */}
          <div className="p-6 overflow-y-auto space-y-6 flex-1">
            
            {/* Customer Information */}
            <div className="bg-slate-800/50 border border-slate-800 rounded-xl p-4 space-y-3">
              <h3 className="text-xs font-semibold text-slate-400 uppercase tracking-wider flex items-center gap-1.5">
                <MapPin className="h-3.5 w-3.5 text-emerald-400" /> Customer Information
              </h3>
              <div className="space-y-1">
                <div className="text-base font-bold text-slate-100">{sale.customerName}</div>
                <div className="text-xs text-slate-300">{sale.address}</div>
                <div className="text-xs font-semibold text-emerald-400">{sale.city}</div>
              </div>
            </div>

            {/* Product & Pricing Breakdown */}
            <div className="bg-slate-800/50 border border-slate-800 rounded-xl p-4 space-y-3">
              <h3 className="text-xs font-semibold text-slate-400 uppercase tracking-wider flex items-center gap-1.5">
                <Package className="h-3.5 w-3.5 text-blue-400" /> Order Summary
              </h3>
              
              <div className="space-y-2 text-xs">
                <div className="flex justify-between py-1 border-b border-slate-800/80">
                  <span className="text-slate-400">Product:</span>
                  <span className="font-semibold text-slate-200">{sale.productName}</span>
                </div>
                <div className="flex justify-between py-1 border-b border-slate-800/80">
                  <span className="text-slate-400">Quantity:</span>
                  <span className="font-mono text-slate-200">{sale.quantity} unit(s)</span>
                </div>
                <div className="flex justify-between py-1 border-b border-slate-800/80">
                  <span className="text-slate-400">Unit Cost Price:</span>
                  <span className="font-mono text-slate-400">{formatPKR(sale.costPrice)}</span>
                </div>
                <div className="flex justify-between py-1 border-b border-slate-800/80">
                  <span className="text-slate-400">Unit Selling Price:</span>
                  <span className="font-mono text-slate-200">{formatPKR(sale.soldPrice)}</span>
                </div>
                <div className="flex justify-between py-1 border-b border-slate-800/80">
                  <span className="text-slate-400">Total Sold Value:</span>
                  <span className="font-mono font-bold text-slate-100">{formatPKR(sale.soldPrice * sale.quantity)}</span>
                </div>
                <div className="flex justify-between py-1 border-b border-slate-800/80">
                  <span className="text-slate-400">Courier Delivery Charge:</span>
                  <span className="font-mono text-slate-300">{formatPKR(sale.deliveryCharge)}</span>
                </div>
              </div>
            </div>

            {/* Financial Realized Profit Card */}
            <div className="bg-gradient-to-br from-slate-900 to-slate-850 border border-slate-700/80 rounded-xl p-4 space-y-2">
              <div className="flex items-center justify-between">
                <span className="text-xs font-semibold text-slate-400 uppercase tracking-wider flex items-center gap-1.5">
                  <DollarSign className="h-3.5 w-3.5 text-emerald-400" /> Net Profit Status
                </span>
                <span className="text-[11px] text-slate-500 font-mono">
                  {new Date(sale.createdAt).toLocaleDateString()}
                </span>
              </div>
              <div className="flex justify-between items-baseline pt-1">
                <span className="text-xs text-slate-300">Realized Margin:</span>
                <span
                  className={`text-xl font-black font-mono ${
                    sale.status === 'DELIVERED'
                      ? 'text-emerald-400'
                      : sale.status === 'RETURNED'
                      ? 'text-rose-400'
                      : 'text-slate-400'
                  }`}
                >
                  {sale.status === 'DELIVERED'
                    ? formatPKR(sale.profit)
                    : sale.status === 'RETURNED'
                    ? formatPKR(sale.profit)
                    : 'Pending Delivery'}
                </span>
              </div>
              {sale.status === 'RETURNED' && (
                <p className="text-[11px] text-rose-400/90 pt-1">
                  Delivery fee ({formatPKR(sale.deliveryCharge)}) recorded as return loss penalty.
                </p>
              )}
            </div>

          </div>

          {/* Action Footer */}
          <div className="p-5 border-t border-slate-800 bg-slate-900/80 space-y-3">
            <div className="grid grid-cols-2 gap-2">
              {sale.status !== 'DELIVERED' && (
                <button
                  onClick={() => {
                    onUpdateStatus(sale.id, 'DELIVERED')
                    onClose()
                  }}
                  className="px-3 py-2 bg-emerald-500 hover:bg-emerald-600 text-slate-950 font-bold text-xs rounded-xl flex items-center justify-center gap-1.5 transition"
                >
                  <CheckCircle2 className="h-4 w-4" /> Mark Delivered
                </button>
              )}

              {sale.status !== 'RETURNED' && (
                <button
                  onClick={() => {
                    onOpenReturnModal(sale)
                    onClose()
                  }}
                  className="px-3 py-2 bg-rose-500/10 hover:bg-rose-500/20 text-rose-400 border border-rose-500/20 font-bold text-xs rounded-xl flex items-center justify-center gap-1.5 transition"
                >
                  <RotateCcw className="h-4 w-4" /> Mark Returned
                </button>
              )}

              {sale.status === 'DISPATCHED' && (
                <button
                  onClick={() => {
                    onUpdateStatus(sale.id, 'CANCELLED')
                    onClose()
                  }}
                  className="px-3 py-2 bg-slate-800 hover:bg-slate-700 text-slate-300 text-xs font-semibold rounded-xl flex items-center justify-center gap-1.5 transition"
                >
                  <XCircle className="h-4 w-4" /> Cancel Order
                </button>
              )}
            </div>

            <button
              onClick={() => {
                onDeleteSale(sale.id)
                onClose()
              }}
              className="w-full py-2 text-xs font-medium text-slate-500 hover:text-rose-400 transition flex items-center justify-center gap-1"
            >
              <Trash2 className="h-3.5 w-3.5" /> Delete Order Record
            </button>
          </div>

        </div>
      </aside>
    </div>
  )
}
