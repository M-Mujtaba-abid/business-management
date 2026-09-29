'use client'

import React from 'react'
import {
  TrendingUp,
  DollarSign,
  Receipt,
  Truck,
  AlertTriangle,
  Plus,
  // PlusCircle, // OLD INVENTORY FLOW (Restock button)
  ArrowUpRight,
  RotateCcw,
  Wallet,
  Recycle,
  Banknote,
} from 'lucide-react'
import StatusBadge from './ui/StatusBadge'
import { Sale, SupplierPayBadge, PaymentBadge } from './OrderList'

interface Partner {
  id: string
  name: string
  totalCapitalInvested: number
}

interface StatsProps {
  stats: {
    totalRevenue: number
    grossProfit: number
    returnLoss: number
    generalExpenses: number
    trueNetProfit: number
    totalExpensesCombined: number
    activeDispatches: number
    totalOrdersCount: number
    partners: Partner[]
    totalSupplierDebt: number
    supplierPendingTotal?: number
    returnedItemsCount?: number
    orderExpenses?: number
    receivablePendingTotal?: number
    receivablePendingCount?: number
  }
  recentSales?: Sale[]
  lowStockProductsCount?: number
  isLoading?: boolean
  onOpenNewDispatch: () => void
  onOpenRestock: () => void
  onOpenExpense: () => void
  onSelectOrder: (sale: Sale) => void
  onViewAllOrders: () => void
  onViewSupplierPayments?: () => void
}

const formatPKR = (amount: number) =>
  new Intl.NumberFormat('en-PK', {
    style: 'currency',
    currency: 'PKR',
    maximumFractionDigits: 0,
  }).format(amount)

const pct = (part: number, base: number) => (base > 0 ? ((part / base) * 100).toFixed(1) : '0.0')

export default function DashboardStats({
  stats,
  recentSales = [],
  // lowStockProductsCount = 0, // OLD INVENTORY FLOW (low stock alert)
  isLoading,
  onOpenNewDispatch,
  // onOpenRestock, // OLD INVENTORY FLOW (Restock button)
  onOpenExpense,
  onSelectOrder,
  onViewAllOrders,
  onViewSupplierPayments,
}: StatsProps) {
  if (isLoading) {
    return (
      <div className="space-y-4">
        <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-4">
          {[...Array(4)].map((_, i) => (
            <div key={i} className="h-32 bg-white border border-slate-200 rounded-2xl animate-pulse" />
          ))}
        </div>
        <div className="grid grid-cols-2 lg:grid-cols-4 gap-4">
          {[...Array(4)].map((_, i) => (
            <div key={i} className="h-20 bg-white border border-slate-200 rounded-2xl animate-pulse" />
          ))}
        </div>
      </div>
    )
  }

  const supplierPending = stats.supplierPendingTotal || 0
  const toReceive = stats.receivablePendingTotal || 0
  const toReceiveCount = stats.receivablePendingCount || 0
  const hasToReceive = toReceive > 0
  const returnedItemsCount = stats.returnedItemsCount || 0
  const orderExpenses = stats.orderExpenses || 0
  const netPositive = stats.trueNetProfit >= 0

  const hasActiveDispatches = stats.activeDispatches > 0
  const hasSupplierPending = supplierPending > 0
  const hasReturnedStock = returnedItemsCount > 0
  /* OLD INVENTORY FLOW — uncomment to restore
  const hasLowStock = lowStockProductsCount > 0
  const hasSupplierDebt = stats.totalSupplierDebt > 0
  */

  return (
    <div className="space-y-6">

      {/* 1. Main numbers */}
      <div className="grid grid-cols-1 sm:grid-cols-3 gap-4">

        {/* Sales */}
        <div className="bg-white border border-slate-200 rounded-2xl p-5 shadow-sm space-y-3">
          <div className="flex items-center justify-between">
            <span className="text-sm font-medium text-slate-500">Sales</span>
            <div className="h-9 w-9 rounded-xl bg-blue-50 text-blue-600 flex items-center justify-center">
              <DollarSign className="h-4 w-4" />
            </div>
          </div>
          <div>
            <div className="text-2xl font-bold text-slate-900">{formatPKR(stats.totalRevenue)}</div>
            <p className="text-xs text-slate-500 mt-1">From delivered orders</p>
          </div>
        </div>

        {/* Profit (after DC / petrol / GST) */}
        <div className="bg-white border border-slate-200 rounded-2xl p-5 shadow-sm space-y-3">
          <div className="flex items-center justify-between">
            <span className="text-sm font-medium text-slate-500">Order Profit</span>
            <div className="h-9 w-9 rounded-xl bg-teal-50 text-teal-600 flex items-center justify-center">
              <TrendingUp className="h-4 w-4" />
            </div>
          </div>
          <div>
            <div className="text-2xl font-bold text-teal-700">{formatPKR(stats.grossProfit)}</div>
            <p className="text-xs text-slate-500 mt-1">
              <span className="font-semibold text-teal-700">{pct(stats.grossProfit, stats.totalRevenue)}%</span> margin · after DC, petrol, GST
            </p>
          </div>
        </div>

        {/* Net profit */}
        <div
          className={`rounded-2xl p-5 shadow-sm space-y-3 border ${
            netPositive ? 'bg-emerald-50 border-emerald-200' : 'bg-rose-50 border-rose-200'
          }`}
        >
          <div className="flex items-center justify-between">
            <span className={`text-sm font-semibold ${netPositive ? 'text-emerald-700' : 'text-rose-700'}`}>Net Profit</span>
            <div
              className={`h-9 w-9 rounded-xl flex items-center justify-center ${
                netPositive ? 'bg-emerald-500 text-white' : 'bg-rose-500 text-white'
              }`}
            >
              <TrendingUp className="h-4 w-4" />
            </div>
          </div>
          <div>
            <div className={`text-2xl font-bold ${netPositive ? 'text-emerald-700' : 'text-rose-700'}`}>
              {formatPKR(stats.trueNetProfit)}
            </div>
            <p className="text-xs text-slate-600 mt-1">
              <span className="font-semibold">{pct(stats.trueNetProfit, stats.totalRevenue)}%</span> · after expenses & returns
            </p>
          </div>
        </div>

      </div>

      {/* 2. Payments: money coming in / going out */}
      <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">

        {/* Money to receive (Daraz / courier / other) */}
        <button
          onClick={onViewSupplierPayments}
          className="text-left bg-white border border-slate-200 hover:border-emerald-300 rounded-2xl p-5 shadow-sm space-y-3 transition"
        >
          <div className="flex items-center justify-between">
            <span className="text-sm font-medium text-slate-500">To Receive</span>
            <div className="h-9 w-9 rounded-xl bg-emerald-50 text-emerald-600 flex items-center justify-center">
              <Banknote className="h-4 w-4" />
            </div>
          </div>
          <div>
            <div className={`text-2xl font-bold ${hasToReceive ? 'text-emerald-600' : 'text-slate-900'}`}>
              {formatPKR(toReceive)}
            </div>
            <p className="text-xs text-slate-500 mt-1 flex items-center gap-1">
              {hasToReceive ? `${toReceiveCount} delivered order(s) not paid yet` : 'All payments received'}{' '}
              <ArrowUpRight className="h-3 w-3" />
            </p>
          </div>
        </button>

        {/* Owed to suppliers */}
        <button
          onClick={onViewSupplierPayments}
          className="text-left bg-white border border-slate-200 hover:border-amber-300 rounded-2xl p-5 shadow-sm space-y-3 transition"
        >
          <div className="flex items-center justify-between">
            <span className="text-sm font-medium text-slate-500">Owed to Suppliers</span>
            <div className="h-9 w-9 rounded-xl bg-amber-50 text-amber-600 flex items-center justify-center">
              <Wallet className="h-4 w-4" />
            </div>
          </div>
          <div>
            <div className={`text-2xl font-bold ${hasSupplierPending ? 'text-amber-600' : 'text-slate-900'}`}>
              {formatPKR(supplierPending)}
            </div>
            <p className="text-xs text-slate-500 mt-1 flex items-center gap-1">
              {hasSupplierPending ? 'Pending payments' : 'All paid'} <ArrowUpRight className="h-3 w-3" />
            </p>
          </div>
        </button>
      </div>

      {/* 3. Secondary numbers */}
      <div className="grid grid-cols-2 lg:grid-cols-4 gap-4">
        {[
          { label: 'Active Orders', value: String(stats.activeDispatches), note: `${stats.totalOrdersCount} total`, icon: Truck, color: 'text-blue-600 bg-blue-50' },
          { label: 'Expenses', value: formatPKR(stats.generalExpenses), note: `${pct(stats.generalExpenses, stats.totalRevenue)}% of sales`, icon: Receipt, color: 'text-rose-600 bg-rose-50' },
          { label: 'Return Loss', value: formatPKR(stats.returnLoss), note: `${pct(stats.returnLoss, stats.totalRevenue)}% of sales`, icon: RotateCcw, color: 'text-orange-600 bg-orange-50' },
          { label: 'Returned Stock', value: String(returnedItemsCount), note: 'covers ready to reuse', icon: Recycle, color: 'text-emerald-600 bg-emerald-50' },
        ].map((card) => {
          const Icon = card.icon
          return (
            <div key={card.label} className="bg-white border border-slate-200 rounded-2xl p-4 shadow-sm flex items-center gap-3">
              <div className={`h-10 w-10 rounded-xl flex items-center justify-center shrink-0 ${card.color}`}>
                <Icon className="h-5 w-5" />
              </div>
              <div className="min-w-0">
                <div className="text-xs text-slate-500">{card.label}</div>
                <div className="text-lg font-bold text-slate-900 truncate">{card.value}</div>
                <div className="text-[11px] text-slate-400">{card.note}</div>
              </div>
            </div>
          )
        })}
      </div>

      {/* 3. How the profit is made */}
      <div className="bg-white border border-slate-200 rounded-2xl p-5 shadow-sm space-y-3">
        <h3 className="text-sm font-semibold text-slate-900">Profit breakdown</h3>
        <div className="flex flex-wrap items-center gap-2 text-xs">
          <div className="px-3 py-2 rounded-xl bg-slate-50 border border-slate-200">
            <div className="text-slate-500">Sales</div>
            <div className="font-bold text-slate-900">{formatPKR(stats.totalRevenue)}</div>
          </div>
          <span className="text-slate-400 font-bold">−</span>
          <div className="px-3 py-2 rounded-xl bg-slate-50 border border-slate-200">
            <div className="text-slate-500">Cover cost + DC/Petrol/GST</div>
            <div className="font-bold text-slate-900">{formatPKR(stats.totalRevenue - stats.grossProfit)}</div>
            <div className="text-[10px] text-slate-400">incl. {formatPKR(orderExpenses)} DC/Petrol/GST</div>
          </div>
          <span className="text-slate-400 font-bold">=</span>
          <div className="px-3 py-2 rounded-xl bg-teal-50 border border-teal-200">
            <div className="text-teal-700">Order profit</div>
            <div className="font-bold text-teal-700">{formatPKR(stats.grossProfit)}</div>
          </div>
          <span className="text-slate-400 font-bold">−</span>
          <div className="px-3 py-2 rounded-xl bg-rose-50 border border-rose-200">
            <div className="text-rose-700">Expenses + return loss</div>
            <div className="font-bold text-rose-700">{formatPKR(stats.totalExpensesCombined)}</div>
          </div>
          <span className="text-slate-400 font-bold">=</span>
          <div
            className={`px-3 py-2 rounded-xl border ${
              netPositive ? 'bg-emerald-50 border-emerald-200 text-emerald-700' : 'bg-rose-50 border-rose-200 text-rose-700'
            }`}
          >
            <div>Net profit</div>
            <div className="font-bold">{formatPKR(stats.trueNetProfit)}</div>
          </div>
        </div>
      </div>

      {/* 4. Quick actions + needs attention */}
      <div className="grid grid-cols-1 lg:grid-cols-3 gap-4">
        <div className="bg-white border border-slate-200 rounded-2xl p-5 shadow-sm space-y-3">
          <h3 className="text-sm font-semibold text-slate-900">Quick actions</h3>
          <button
            onClick={onOpenNewDispatch}
            className="w-full px-4 py-2.5 bg-emerald-500 hover:bg-emerald-600 text-white font-semibold text-sm rounded-xl flex items-center justify-center gap-2 transition"
          >
            <Plus className="h-4 w-4" /> New Order
          </button>
          {/* OLD INVENTORY FLOW — uncomment to restore
          <button
            onClick={onOpenRestock}
            className="w-full px-4 py-2.5 bg-white hover:bg-slate-50 text-slate-700 border border-slate-200 text-sm font-medium rounded-xl flex items-center justify-center gap-2 transition"
          >
            <PlusCircle className="h-4 w-4 text-emerald-600" /> Restock Inventory
          </button>
          */}
          <button
            onClick={onOpenExpense}
            className="w-full px-4 py-2.5 bg-white hover:bg-slate-50 text-slate-700 border border-slate-200 text-sm font-medium rounded-xl flex items-center justify-center gap-2 transition"
          >
            <Receipt className="h-4 w-4 text-rose-500" /> Add Expense
          </button>
        </div>

        <div className="lg:col-span-2 bg-white border border-slate-200 rounded-2xl p-5 shadow-sm space-y-3">
          <h3 className="text-sm font-semibold text-slate-900 flex items-center gap-2">
            <AlertTriangle className="h-4 w-4 text-amber-500" /> Needs attention
          </h3>

          {!hasActiveDispatches && !hasSupplierPending && !hasReturnedStock && !hasToReceive ? (
            <p className="text-sm text-slate-500 py-4 text-center">All clear. Nothing needs attention.</p>
          ) : (
            <div className="space-y-2">
              {hasActiveDispatches && (
                <div className="flex items-center justify-between gap-3 rounded-xl border border-blue-100 bg-blue-50 px-4 py-3 text-sm">
                  <div className="flex items-center gap-2 text-blue-800">
                    <Truck className="h-4 w-4 shrink-0" />
                    <span><b>{stats.activeDispatches}</b> order(s) waiting for delivery</span>
                  </div>
                  <button onClick={onViewAllOrders} className="text-xs font-semibold text-blue-700 hover:underline shrink-0">
                    Review
                  </button>
                </div>
              )}

              {hasToReceive && (
                <div className="flex items-center justify-between gap-3 rounded-xl border border-emerald-100 bg-emerald-50 px-4 py-3 text-sm">
                  <div className="flex items-center gap-2 text-emerald-800">
                    <Banknote className="h-4 w-4 shrink-0" />
                    <span><b>{formatPKR(toReceive)}</b> not received yet for {toReceiveCount} delivered order(s)</span>
                  </div>
                  {onViewSupplierPayments && (
                    <button onClick={onViewSupplierPayments} className="text-xs font-semibold text-emerald-700 hover:underline shrink-0">
                      View
                    </button>
                  )}
                </div>
              )}

              {hasSupplierPending && (
                <div className="flex items-center justify-between gap-3 rounded-xl border border-amber-100 bg-amber-50 px-4 py-3 text-sm">
                  <div className="flex items-center gap-2 text-amber-800">
                    <Wallet className="h-4 w-4 shrink-0" />
                    <span><b>{formatPKR(supplierPending)}</b> still owed to suppliers</span>
                  </div>
                  {onViewSupplierPayments && (
                    <button onClick={onViewSupplierPayments} className="text-xs font-semibold text-amber-700 hover:underline shrink-0">
                      View
                    </button>
                  )}
                </div>
              )}

              {hasReturnedStock && (
                <div className="flex items-center gap-2 rounded-xl border border-emerald-100 bg-emerald-50 px-4 py-3 text-sm text-emerald-800">
                  <Recycle className="h-4 w-4 shrink-0" />
                  <span><b>{returnedItemsCount}</b> returned cover(s) ready to use in a new order</span>
                </div>
              )}

              {/* OLD INVENTORY FLOW — uncomment to restore
              {hasLowStock && (
                <div className="flex items-center justify-between gap-3 rounded-xl border border-amber-100 bg-amber-50 px-4 py-3 text-sm">
                  <span className="text-amber-800">{lowStockProductsCount} product(s) running low on stock</span>
                  <button onClick={onOpenRestock} className="text-xs font-semibold text-amber-700 hover:underline">Restock</button>
                </div>
              )}
              {hasSupplierDebt && (
                <div className="rounded-xl border border-purple-100 bg-purple-50 px-4 py-3 text-sm text-purple-800">
                  Rs. {stats.totalSupplierDebt.toLocaleString()} unpaid supplier balance (restock credit)
                </div>
              )}
              */}
            </div>
          )}
        </div>
      </div>

      {/* 5. Recent orders */}
      <div className="bg-white border border-slate-200 rounded-2xl p-5 shadow-sm space-y-4">
        <div className="flex justify-between items-center">
          <h3 className="text-sm font-semibold text-slate-900">Recent orders</h3>
          <button
            onClick={onViewAllOrders}
            className="text-xs font-semibold text-emerald-600 hover:text-emerald-700 flex items-center gap-1 transition"
          >
            View all <ArrowUpRight className="h-3.5 w-3.5" />
          </button>
        </div>

        {recentSales.length === 0 ? (
          <div className="p-8 text-center border border-dashed border-slate-200 rounded-xl text-slate-500 text-sm">
            No orders yet. Click &quot;New Order&quot; to add your first one.
          </div>
        ) : (
          <div className="overflow-x-auto">
            <table className="w-full text-left text-sm">
              <thead className="text-xs text-slate-500 border-b border-slate-200">
                <tr>
                  <th className="px-3 py-2 font-medium">Item</th>
                  <th className="px-3 py-2 font-medium">Supplier</th>
                  <th className="px-3 py-2 font-medium">Amount</th>
                  <th className="px-3 py-2 font-medium">Status</th>
                  <th className="px-3 py-2 font-medium">Payment</th>
                  <th className="px-3 py-2 font-medium">Supplier pay</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-slate-100">
                {recentSales.slice(0, 6).map((sale) => (
                  <tr key={sale.id} className="hover:bg-slate-50 transition cursor-pointer" onClick={() => onSelectOrder(sale)}>
                    <td className="px-3 py-3">
                      <div className="font-medium text-slate-900">{sale.productName}</div>
                      {(sale.orderSource?.name || sale.category?.name) && (
                        <div className="text-xs text-slate-500">
                          {[sale.orderSource?.name, sale.category?.name].filter(Boolean).join(' · ')}
                        </div>
                      )}
                    </td>
                    <td className="px-3 py-3 text-slate-600">
                      {sale.supplier?.name || (sale.returnedItemId ? 'Returned stock' : '—')}
                    </td>
                    <td className="px-3 py-3">
                      <div className="font-semibold text-slate-900">{formatPKR(sale.soldPrice * sale.quantity)}</div>
                      <div className="text-xs text-slate-500">Profit {formatPKR(sale.profit)}</div>
                    </td>
                    <td className="px-3 py-3">
                      <StatusBadge status={sale.status} />
                    </td>
                    <td className="px-3 py-3">
                      <PaymentBadge status={sale.paymentStatus} />
                    </td>
                    <td className="px-3 py-3">
                      <SupplierPayBadge status={sale.supplierPaymentStatus} />
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        )}
      </div>

    </div>
  )
}
