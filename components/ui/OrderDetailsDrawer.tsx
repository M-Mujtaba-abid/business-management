'use client'

import React, { useState, useEffect, useMemo } from 'react'
import { X, MapPin, Package, DollarSign, Trash2, CheckCircle2, RotateCcw, XCircle, Wallet, Banknote, Pencil } from 'lucide-react'
import StatusBadge from './StatusBadge'
import { Sale, SupplierPayBadge, PaymentBadge } from '../OrderList'
import { groupSales, groupAsSale } from '@/lib/parcels'

export type { Sale }

interface OrderDetailsDrawerProps {
  // The order's products: one for a single-product order, several for a parcel
  items: Sale[]
  isOpen: boolean
  onClose: () => void
  onUpdateStatus: (id: string, status: string) => void
  onOpenReturnModal: (sale: Sale) => void
  onDeleteSale: (id: string) => void
  onSetSupplierPayment: (saleIds: string[], status: 'PAID' | 'PENDING') => Promise<void>
  onSetCustomerPayment: (saleIds: string[], status: 'RECEIVED' | 'NOT_RECEIVED') => Promise<void>
  onSetReceivedBy: (saleIds: string[], personId: string | null) => Promise<void>
  onReceivePayment: (sale: Sale, mode: 'receive' | 'edit') => void
  onEditOrder: (items: Sale[]) => void
}

const formatPKR = (amt: number) => `Rs. ${Math.round(amt).toLocaleString()}`

export default function OrderDetailsDrawer({
  items,
  isOpen,
  onClose,
  onUpdateStatus,
  onOpenReturnModal,
  onDeleteSale,
  onSetSupplierPayment,
  onSetCustomerPayment,
  onSetReceivedBy,
  onReceivePayment,
  onEditOrder,
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

  const group = useMemo(() => (items.length ? groupSales(items)[0] : null), [items])

  if (!isOpen || !group) return null

  const sale = group.lead // shared fields: status, payment, customer, sources
  const isParcel = group.items.length > 1
  const asOne = groupAsSale(group) // the whole parcel as one order, for popups
  const cut = group.saleTotal - group.payout
  const trackedIds = group.items.filter((i) => i.supplierPaymentStatus !== 'NOT_APPLICABLE').map((i) => i.id)

  return (
    <div className="fixed inset-0 z-50 overflow-hidden bg-slate-900/30 backdrop-blur-sm animate-in fade-in">
      <div className="absolute inset-0" onClick={onClose} />

      <aside className="absolute inset-y-0 right-0 max-w-full flex sm:pl-10">
        <div className="w-screen max-w-md bg-white border-l border-slate-200 text-slate-900 shadow-2xl flex flex-col justify-between">

          {/* Top Bar */}
          <div className="p-4 sm:p-6 border-b border-slate-200 flex items-center justify-between bg-white/50">
            <div className="min-w-0">
              <div className="flex items-center gap-2">
                <span className="text-xs font-mono text-slate-500 uppercase">{isParcel ? `Order · ${group.items.length} items` : 'Order Details'}</span>
                <StatusBadge status={sale.status} />
              </div>
              <h2 className="text-lg font-bold text-slate-900 mt-1 truncate">
                {isParcel ? group.items.map((i) => i.productName).join(', ') : sale.productName}
              </h2>
            </div>
            <div className="flex items-center gap-1 shrink-0">
              <button
                onClick={() => {
                  onEditOrder(group.items)
                  onClose()
                }}
                className="px-2.5 py-1.5 rounded-lg bg-blue-50 border border-blue-200 text-blue-700 text-xs font-semibold hover:bg-blue-100 flex items-center gap-1 transition"
              >
                <Pencil className="h-3.5 w-3.5" /> Edit
              </button>
              <button
                onClick={onClose}
                className="p-1 rounded-lg text-slate-500 hover:text-slate-900 hover:bg-slate-100 transition"
              >
                <X className="h-5 w-5" />
              </button>
            </div>
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

            {/* Products */}
            <div className="bg-slate-50 border border-slate-200 rounded-xl p-4 space-y-3">
              <h3 className="text-xs font-semibold text-slate-500 uppercase tracking-wider flex items-center gap-1.5">
                <Package className="h-3.5 w-3.5 text-blue-600" /> {isParcel ? 'Products' : 'Order Summary'}
              </h3>

              {sale.orderSource?.name && (
                <div className="flex justify-between text-xs">
                  <span className="text-slate-500">Order from:</span>
                  <span className="font-semibold text-violet-700">{sale.orderSource.name}</span>
                </div>
              )}

              <div className="space-y-2">
                {group.items.map((item) => (
                  <div key={item.id} className="rounded-lg bg-white border border-slate-200 p-3 space-y-1.5 text-xs">
                    <div className="flex items-start justify-between gap-2">
                      <div className="min-w-0">
                        <div className="font-semibold text-slate-900 break-words">{item.productName}</div>
                        <div className="text-[11px] text-slate-500">
                          {item.category?.name && <span className="text-sky-600">{item.category.name} · </span>}
                          {item.supplier?.name || (item.returnedItemId ? '♻ Returned stock' : 'No supplier')}
                        </div>
                      </div>
                      <div className="text-right shrink-0 font-mono">
                        <div className="font-bold text-slate-900">{formatPKR(item.soldPrice * item.quantity)}</div>
                        <div className="text-[11px] text-slate-500">
                          {item.quantity} × {formatPKR(item.soldPrice)}
                        </div>
                      </div>
                    </div>
                    <div className="flex items-center justify-between gap-2">
                      <span className="text-[11px] text-slate-500 font-mono">Cost {formatPKR(item.costPrice * item.quantity)}</span>
                      {item.supplierPaymentStatus !== 'NOT_APPLICABLE' && (
                        <SupplierPayBadge
                          status={item.supplierPaymentStatus}
                          onClick={async () => {
                            await onSetSupplierPayment([item.id], item.supplierPaymentStatus === 'PAID' ? 'PENDING' : 'PAID')
                            onClose()
                          }}
                        />
                      )}
                    </div>
                  </div>
                ))}
              </div>

              <div className="space-y-1.5 text-xs pt-1">
                <div className="flex justify-between">
                  <span className="text-slate-500">Total sale:</span>
                  <span className="font-mono font-bold text-slate-900">{formatPKR(group.saleTotal)}</span>
                </div>
                <div className="flex justify-between">
                  <span className="text-slate-500">Cover cost:</span>
                  <span className="font-mono text-slate-700">{formatPKR(group.costTotal)}</span>
                </div>
                <div className="flex justify-between">
                  <span className="text-slate-500">DC / Petrol / GST:</span>
                  <span className="font-mono text-slate-700">
                    {formatPKR(group.deliveryCharge)} / {formatPKR(group.petrolCost)} / {formatPKR(group.gstAmount)}
                  </span>
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
                    sale.status === 'DELIVERED' ? 'text-emerald-600' : sale.status === 'RETURNED' ? 'text-rose-600' : 'text-slate-500'
                  }`}
                >
                  {sale.status === 'DELIVERED' || sale.status === 'RETURNED' ? formatPKR(group.profit) : 'Pending Delivery'}
                </span>
              </div>
              {sale.status === 'RETURNED' && (
                <p className="text-[11px] text-rose-600/90 pt-1">Return loss: {formatPKR(-group.profit)}</p>
              )}
            </div>

            {/* Payment to receive (Daraz / courier / other) — one payment for the whole parcel */}
            {sale.paymentStatus !== 'NOT_APPLICABLE' && (
              <div className="bg-slate-50 border border-slate-200 rounded-xl p-4 space-y-3">
                <div className="flex items-center justify-between">
                  <h3 className="text-xs font-semibold text-slate-500 uppercase tracking-wider flex items-center gap-1.5">
                    <Banknote className="h-3.5 w-3.5 text-emerald-600" /> Payment
                  </h3>
                  <PaymentBadge status={sale.paymentStatus} />
                </div>
                <div className="text-xs text-slate-700 space-y-1">
                  <div>
                    From <span className="font-semibold">{sale.paymentSource?.name || 'no source set'}</span>
                    {sale.paymentStatus === 'RECEIVED' && sale.paymentReceivedAt && (
                      <span className="text-slate-500"> · received on {new Date(sale.paymentReceivedAt).toLocaleDateString()}</span>
                    )}
                  </div>
                  <div className="flex items-center justify-between gap-2">
                    <span>
                      {sale.paymentStatus === 'RECEIVED' ? 'Received' : 'Expected'}:{' '}
                      <span className="font-mono font-bold">{formatPKR(group.payout)}</span>
                      {Math.abs(cut) >= 0.5 && (
                        <span className={cut > 0 ? 'text-rose-600' : 'text-emerald-600'}>
                          {' '}({cut > 0 ? '−' : '+'}{formatPKR(Math.abs(cut))} {cut > 0 ? 'cut' : 'extra'})
                        </span>
                      )}
                    </span>
                    <button
                      onClick={() => onReceivePayment(asOne, 'edit')}
                      className="px-2 py-1 rounded-lg bg-white border border-slate-300 text-[11px] font-semibold text-slate-700 hover:bg-slate-100 shrink-0"
                    >
                      Edit amount
                    </button>
                  </div>
                </div>
                <label className="flex items-center justify-between gap-2 text-xs text-slate-700">
                  <span>Money goes to</span>
                  <select
                    value={sale.receivedBy?.id || ''}
                    onChange={async (e) => {
                      await onSetReceivedBy(group.ids, e.target.value || null)
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
                    if (sale.paymentStatus === 'RECEIVED') {
                      await onSetCustomerPayment(group.ids, 'NOT_RECEIVED')
                      onClose()
                    } else {
                      onReceivePayment(asOne, 'receive')
                    }
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

            {/* Supplier Payment (each product's supplier is paid separately; this button does them all) */}
            {trackedIds.length > 0 && (
              <div className="bg-slate-50 border border-slate-200 rounded-xl p-4 space-y-3">
                <div className="flex items-center justify-between">
                  <h3 className="text-xs font-semibold text-slate-500 uppercase tracking-wider flex items-center gap-1.5">
                    <Wallet className="h-3.5 w-3.5 text-amber-600" /> Supplier Payment
                  </h3>
                  {!isParcel && <SupplierPayBadge status={sale.supplierPaymentStatus} />}
                </div>
                <div className="text-xs text-slate-700">
                  Owed to {group.supplierNames.filter((n) => n !== 'Returned stock').join(', ') || 'supplier'}:{' '}
                  <span className="font-mono font-bold">
                    {formatPKR(
                      group.items
                        .filter((i) => i.supplierPaymentStatus !== 'NOT_APPLICABLE')
                        .reduce((a, i) => a + i.costPrice * i.quantity, 0)
                    )}
                  </span>
                  {isParcel && group.supplierPending > 0 && (
                    <span className="text-amber-700"> · {group.supplierPending} of {group.supplierTracked} pending</span>
                  )}
                  {!isParcel && sale.supplierPaymentStatus === 'PAID' && sale.supplierPaidAt && (
                    <span className="text-slate-500"> · paid on {new Date(sale.supplierPaidAt).toLocaleDateString()}</span>
                  )}
                </div>
                <button
                  onClick={async () => {
                    await onSetSupplierPayment(trackedIds, group.supplierPending > 0 ? 'PAID' : 'PENDING')
                    onClose()
                  }}
                  className={`w-full px-3 py-2 text-xs font-bold rounded-xl transition ${
                    group.supplierPending === 0
                      ? 'bg-slate-100 hover:bg-slate-200 text-slate-700'
                      : 'bg-amber-500 hover:bg-amber-600 text-white'
                  }`}
                >
                  {group.supplierPending === 0
                    ? isParcel ? 'Mark all as Pending' : 'Mark as Pending'
                    : isParcel ? 'Mark all suppliers as Paid' : 'Mark supplier as Paid'}
                </button>
              </div>
            )}

          </div>

          {/* Action Footer — applies to the whole order / parcel */}
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
                    onOpenReturnModal(asOne)
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
              <Trash2 className="h-3.5 w-3.5" /> {isParcel ? `Delete Order (${group.items.length} items)` : 'Delete Order Record'}
            </button>
          </div>

        </div>
      </aside>
    </div>
  )
}
