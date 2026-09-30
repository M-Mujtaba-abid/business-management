'use client'

import React, { useState, useEffect } from 'react'
import { X, MapPin, Package, DollarSign, Trash2, CheckCircle2, RotateCcw, XCircle, Wallet, Banknote } from 'lucide-react'
import StatusBadge from './StatusBadge'
import { Sale, SupplierPayBadge, PaymentBadge } from '../OrderList'

export type { Sale }

interface OrderDetailsDrawerProps {
  sale: Sale | null
  isOpen: boolean
  onClose: () => void
  onUpdateStatus: (id: string, status: string) => void
  onOpenReturnModal: (sale: Sale) => void
  onDeleteSale: (id: string) => void
  onSetSupplierPayment: (saleIds: string[], status: 'PAID' | 'PENDING') => Promise<void>
  onSetCustomerPayment: (saleIds: string[], status: 'RECEIVED' | 'NOT_RECEIVED') => Promise<void>
  onSetReceivedBy: (saleIds: string[], personId: string | null) => Promise<void>
}

export default function OrderDetailsDrawer({
  sale,
  isOpen,
  onClose,
  onUpdateStatus,
  onOpenReturnModal,
  onDeleteSale,
  onSetSupplierPayment,
  onSetCustomerPayment,
  onSetReceivedBy,
}: OrderDetailsDrawerProps) {
  const [people, setPeople] = useState<{ id: string; name: string }[]>([])

  useEffect(() => {
    if (!isOpen) return
    fetch('/api/people')
      .then((r) => r.json())
      .then((data) => {
        if (Array.isArray(data)) setPeople(data)
      })
      .catch(console.error)
  }, [isOpen])

  if (!isOpen || !sale) return null

  const formatPKR = (amt: number) => `Rs. ${amt.toLocaleString()}`

  return (
    <div className="fixed inset-0 z-50 overflow-hidden bg-slate-900/30 backdrop-blur-sm animate-in fade-in">
      <div className="absolute inset-0" onClick={onClose} />

      <aside className="absolute inset-y-0 right-0 max-w-full flex sm:pl-10">
        <div className="w-screen max-w-md bg-white border-l border-slate-200 text-slate-900 shadow-2xl flex flex-col justify-between">
          
          {/* Top Bar */}
          <div className="p-4 sm:p-6 border-b border-slate-200 flex items-center justify-between bg-white/50">
            <div>
              <div className="flex items-center gap-2">
                <span className="text-xs font-mono text-slate-500 uppercase">Order Details</span>
                <StatusBadge status={sale.status} />
              </div>
              <h2 className="text-lg font-bold text-slate-900 mt-1">{sale.productName}</h2>
            </div>
            <button
              onClick={onClose}
              className="p-1 rounded-lg text-slate-500 hover:text-slate-900 hover:bg-slate-100 transition"
            >
              <X className="h-5 w-5" />
            </button>
          </div>

          {/* Drawer Body Details */}
          <div className="p-4 sm:p-6 overflow-y-auto space-y-4 sm:space-y-6 flex-1">
            
            {/* Customer Information */}
            <div className="bg-slate-50 border border-slate-200 rounded-xl p-4 space-y-3">
              <h3 className="text-xs font-semibold text-slate-500 uppercase tracking-wider flex items-center gap-1.5">
                <MapPin className="h-3.5 w-3.5 text-emerald-600" /> Customer Information
              </h3>
              <div className="space-y-1">
                <div className="text-base font-bold text-slate-900">{sale.customerName}</div>
                <div className="text-xs text-slate-700">{sale.address}</div>
                <div className="text-xs font-semibold text-emerald-600">{sale.city}</div>
              </div>
            </div>

            {/* Product & Pricing Breakdown */}
            <div className="bg-slate-50 border border-slate-200 rounded-xl p-4 space-y-3">
              <h3 className="text-xs font-semibold text-slate-500 uppercase tracking-wider flex items-center gap-1.5">
                <Package className="h-3.5 w-3.5 text-blue-600" /> Order Summary
              </h3>
              
              <div className="space-y-2 text-xs">
                <div className="flex justify-between py-1 border-b border-slate-200/80">
                  <span className="text-slate-500">Product:</span>
                  <span className="font-semibold text-slate-800">{sale.productName}</span>
                </div>
                {sale.orderSource?.name && (
                  <div className="flex justify-between py-1 border-b border-slate-200/80">
                    <span className="text-slate-500">Order from:</span>
                    <span className="font-semibold text-violet-700">{sale.orderSource.name}</span>
                  </div>
                )}
                {sale.category?.name && (
                  <div className="flex justify-between py-1 border-b border-slate-200/80">
                    <span className="text-slate-500">Category:</span>
                    <span className="font-semibold text-sky-600">{sale.category.name}</span>
                  </div>
                )}
                <div className="flex justify-between py-1 border-b border-slate-200/80">
                  <span className="text-slate-500">Bought from:</span>
                  <span className="font-semibold text-slate-800">
                    {sale.supplier?.name || (sale.returnedItemId ? '♻ Returned stock' : '—')}
                  </span>
                </div>
                <div className="flex justify-between py-1 border-b border-slate-200/80">
                  <span className="text-slate-500">Quantity:</span>
                  <span className="font-mono text-slate-800">{sale.quantity} unit(s)</span>
                </div>
                <div className="flex justify-between py-1 border-b border-slate-200/80">
                  <span className="text-slate-500">Unit Cost Price:</span>
                  <span className="font-mono text-slate-500">{formatPKR(sale.costPrice)}</span>
                </div>
                <div className="flex justify-between py-1 border-b border-slate-200/80">
                  <span className="text-slate-500">Unit Selling Price:</span>
                  <span className="font-mono text-slate-800">{formatPKR(sale.soldPrice)}</span>
                </div>
                <div className="flex justify-between py-1 border-b border-slate-200/80">
                  <span className="text-slate-500">Total Sold Value:</span>
                  <span className="font-mono font-bold text-slate-900">{formatPKR(sale.soldPrice * sale.quantity)}</span>
                </div>
                <div className="flex justify-between py-1 border-b border-slate-200/80">
                  <span className="text-slate-500">DC (Delivery Charge):</span>
                  <span className="font-mono text-slate-700">{formatPKR(sale.deliveryCharge)}</span>
                </div>
                <div className="flex justify-between py-1 border-b border-slate-200/80">
                  <span className="text-slate-500">Petrol:</span>
                  <span className="font-mono text-slate-700">{formatPKR(sale.petrolCost || 0)}</span>
                </div>
                <div className="flex justify-between py-1 border-b border-slate-200/80">
                  <span className="text-slate-500">GST:</span>
                  <span className="font-mono text-slate-700">{formatPKR(sale.gstAmount || 0)}</span>
                </div>
              </div>
            </div>

            {/* Financial Realized Profit Card */}
            <div className="bg-gradient-to-br from-white to-slate-50 border border-slate-300/80 rounded-xl p-4 space-y-2">
              <div className="flex items-center justify-between">
                <span className="text-xs font-semibold text-slate-500 uppercase tracking-wider flex items-center gap-1.5">
                  <DollarSign className="h-3.5 w-3.5 text-emerald-600" /> Net Profit Status
                </span>
                <span className="text-[11px] text-slate-500 font-mono">
                  {new Date(sale.createdAt).toLocaleDateString()}
                </span>
              </div>
              <div className="flex justify-between items-baseline pt-1">
                <span className="text-xs text-slate-700">Realized Margin:</span>
                <span
                  className={`text-xl font-black font-mono ${
                    sale.status === 'DELIVERED'
                      ? 'text-emerald-600'
                      : sale.status === 'RETURNED'
                      ? 'text-rose-600'
                      : 'text-slate-500'
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
                <p className="text-[11px] text-rose-600/90 pt-1">
                  Return loss: {formatPKR(-sale.profit)}
                </p>
              )}
            </div>

            {/* Payment to receive (Daraz / courier / other) */}
            {sale.paymentStatus !== 'NOT_APPLICABLE' && (
              <div className="bg-slate-50 border border-slate-200 rounded-xl p-4 space-y-3">
                <div className="flex items-center justify-between">
                  <h3 className="text-xs font-semibold text-slate-500 uppercase tracking-wider flex items-center gap-1.5">
                    <Banknote className="h-3.5 w-3.5 text-emerald-600" /> Payment
                  </h3>
                  <PaymentBadge status={sale.paymentStatus} />
                </div>
                <div className="text-xs text-slate-700">
                  From <span className="font-semibold">{sale.paymentSource?.name || 'no source set'}</span>:{' '}
                  <span className="font-mono font-bold">{formatPKR(sale.soldPrice * sale.quantity)}</span>
                  {sale.paymentStatus === 'RECEIVED' && sale.paymentReceivedAt && (
                    <span className="text-slate-500"> · received on {new Date(sale.paymentReceivedAt).toLocaleDateString()}</span>
                  )}
                </div>
                <label className="flex items-center justify-between gap-2 text-xs text-slate-700">
                  <span>Money goes to</span>
                  <select
                    value={sale.receivedBy?.id || ''}
                    onChange={async (e) => {
                      await onSetReceivedBy([sale.id], e.target.value || null)
                      onClose()
                    }}
                    className="bg-white border border-slate-300 rounded-lg px-2 py-1 text-xs text-slate-800 focus:outline-none focus:border-emerald-500"
                  >
                    <option value="">Not set</option>
                    {people.map((p) => (
                      <option key={p.id} value={p.id}>{p.name}</option>
                    ))}
                  </select>
                </label>
                <button
                  onClick={async () => {
                    await onSetCustomerPayment([sale.id], sale.paymentStatus === 'RECEIVED' ? 'NOT_RECEIVED' : 'RECEIVED')
                    onClose()
                  }}
                  className={`w-full px-3 py-2 text-xs font-bold rounded-xl transition ${
                    sale.paymentStatus === 'RECEIVED'
                      ? 'bg-slate-100 hover:bg-slate-200 text-slate-700'
                      : 'bg-emerald-500 hover:bg-emerald-600 text-white'
                  }`}
                >
                  {sale.paymentStatus === 'RECEIVED' ? 'Mark as Not received' : 'Mark Payment Received'}
                </button>
              </div>
            )}

            {/* Supplier Payment */}
            {sale.supplierPaymentStatus !== 'NOT_APPLICABLE' && (
              <div className="bg-slate-50 border border-slate-200 rounded-xl p-4 space-y-3">
                <div className="flex items-center justify-between">
                  <h3 className="text-xs font-semibold text-slate-500 uppercase tracking-wider flex items-center gap-1.5">
                    <Wallet className="h-3.5 w-3.5 text-amber-600" /> Supplier Payment
                  </h3>
                  <SupplierPayBadge status={sale.supplierPaymentStatus} />
                </div>
                <div className="text-xs text-slate-700">
                  Owed to {sale.supplier?.name || 'supplier'}:{' '}
                  <span className="font-mono font-bold">{formatPKR(sale.costPrice * sale.quantity)}</span>
                  {sale.supplierPaymentStatus === 'PAID' && sale.supplierPaidAt && (
                    <span className="text-slate-500"> · paid on {new Date(sale.supplierPaidAt).toLocaleDateString()}</span>
                  )}
                </div>
                <button
                  onClick={async () => {
                    await onSetSupplierPayment([sale.id], sale.supplierPaymentStatus === 'PAID' ? 'PENDING' : 'PAID')
                    onClose()
                  }}
                  className={`w-full px-3 py-2 text-xs font-bold rounded-xl transition ${
                    sale.supplierPaymentStatus === 'PAID'
                      ? 'bg-slate-100 hover:bg-slate-200 text-slate-700'
                      : 'bg-amber-500 hover:bg-amber-600 text-white'
                  }`}
                >
                  {sale.supplierPaymentStatus === 'PAID' ? 'Mark as Pending' : 'Mark supplier as Paid'}
                </button>
              </div>
            )}

          </div>

          {/* Action Footer */}
          <div className="p-5 border-t border-slate-200 bg-white/80 space-y-3">
            <div className="grid grid-cols-2 gap-2">
              {sale.status !== 'DELIVERED' && (
                <button
                  onClick={() => {
                    onUpdateStatus(sale.id, 'DELIVERED')
                    onClose()
                  }}
                  className="px-3 py-2 bg-emerald-500 hover:bg-emerald-600 text-white font-bold text-xs rounded-xl flex items-center justify-center gap-1.5 transition"
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
                  className="px-3 py-2 bg-rose-500/10 hover:bg-rose-500/20 text-rose-600 border border-rose-500/20 font-bold text-xs rounded-xl flex items-center justify-center gap-1.5 transition"
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
                  className="px-3 py-2 bg-slate-100 hover:bg-slate-200 text-slate-700 text-xs font-semibold rounded-xl flex items-center justify-center gap-1.5 transition"
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
              className="w-full py-2 text-xs font-medium text-slate-500 hover:text-rose-600 transition flex items-center justify-center gap-1"
            >
              <Trash2 className="h-3.5 w-3.5" /> Delete Order Record
            </button>
          </div>

        </div>
      </aside>
    </div>
  )
}
