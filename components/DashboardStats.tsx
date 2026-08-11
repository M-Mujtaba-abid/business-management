'use client'

import React from 'react'
import {
  TrendingUp,
  DollarSign,
  Receipt,
  Truck,
  HelpCircle,
  AlertTriangle,
  Sparkles,
  PlusCircle,
  ArrowUpRight,
  RotateCcw,
} from 'lucide-react'
import StatusBadge from './ui/StatusBadge'
import { Sale } from './OrderList'

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
  }
  recentSales?: Sale[]
  lowStockProductsCount?: number
  isLoading?: boolean
  onOpenNewDispatch: () => void
  onOpenRestock: () => void
  onOpenExpense: () => void
  onSelectOrder: (sale: Sale) => void
  onViewAllOrders: () => void
}

export default function DashboardStats({
  stats,
  recentSales = [],
  lowStockProductsCount = 0,
  isLoading,
  onOpenNewDispatch,
  onOpenRestock,
  onOpenExpense,
  onSelectOrder,
  onViewAllOrders,
}: StatsProps) {
  const formatPKR = (amount: number) => {
    return new Intl.NumberFormat('en-PK', {
      style: 'currency',
      currency: 'PKR',
      maximumFractionDigits: 0,
    }).format(amount)
  }

  if (isLoading) {
    return (
      <div className="space-y-6">
        <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-5 gap-4">
          {[...Array(5)].map((_, i) => (
            <div key={i} className="h-28 bg-slate-900/60 border border-slate-800 rounded-2xl animate-pulse" />
          ))}
        </div>
      </div>
    )
  }

  // Generate actionable Needs Attention alerts based on live data
  const hasLowStock = lowStockProductsCount > 0
  const hasActiveDispatches = stats.activeDispatches > 0
  const hasSupplierDebt = stats.totalSupplierDebt > 0
  const hasReturnLosses = stats.returnLoss > 0

  // Calculate percentage ratios relative to Total Revenue
  const revBase = stats.totalRevenue > 0 ? stats.totalRevenue : 1
  const grossMarginPct = stats.totalRevenue > 0 ? ((stats.grossProfit / revBase) * 100).toFixed(1) : '0.0'
  const netMarginPct = stats.totalRevenue > 0 ? ((stats.trueNetProfit / revBase) * 100).toFixed(1) : '0.0'
  const expensesPct = stats.totalRevenue > 0 ? ((stats.generalExpenses / revBase) * 100).toFixed(1) : '0.0'
  const returnLossPct = stats.totalRevenue > 0 ? ((stats.returnLoss / revBase) * 100).toFixed(1) : '0.0'
  const combinedExpPct = stats.totalRevenue > 0 ? ((stats.totalExpensesCombined / revBase) * 100).toFixed(1) : '0.0'

  return (
    <div className="space-y-8">

      {/* 1. Primary Financial & Operational KPI Cards Grid */}
      <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 xl:grid-cols-6 gap-4">

        {/* KPI 1: Revenue */}
        <div className="bg-slate-900 border border-slate-800 rounded-2xl p-4 hover:border-slate-700 transition space-y-2">
          <div className="flex items-center justify-between">
            <span className="text-xs font-semibold text-slate-400">Total Sales</span>
            <div className="h-8 w-8 rounded-xl bg-blue-500/10 text-blue-400 flex items-center justify-center">
              <DollarSign className="h-4 w-4" />
            </div>
          </div>
          <div>
            <div className="text-2xl font-bold text-slate-100">{formatPKR(stats.totalRevenue)}</div>
            <div className="flex items-center gap-1 mt-1">
              <span className="px-2 py-0.5 rounded-full text-[10px] font-bold bg-blue-500/20 text-blue-300 border border-blue-500/30">
                100% Base
              </span>
              <span className="text-[11px] text-slate-400">Delivered</span>
            </div>
          </div>
        </div>

        {/* KPI 2: Overall Sales Profit (Gross Margin before Expenses) */}
        <div className="bg-gradient-to-br from-slate-900 to-teal-950/40 border border-teal-500/30 rounded-2xl p-4 shadow-lg space-y-2">
          <div className="flex items-center justify-between">
            <span className="text-xs font-bold text-teal-400 uppercase tracking-wider">Overall Sales Profit</span>
            <div className="h-8 w-8 rounded-xl bg-teal-500/20 text-teal-400 flex items-center justify-center">
              <TrendingUp className="h-4 w-4" />
            </div>
          </div>
          <div>
            <div className="text-2xl font-black text-teal-400">{formatPKR(stats.grossProfit)}</div>
            <div className="flex items-center gap-1.5 mt-1">
              <span className="px-2 py-0.5 rounded-full text-[10px] font-bold bg-teal-500/20 text-teal-300 border border-teal-500/30">
                {grossMarginPct}% Margin
              </span>
              <span className="text-[11px] text-slate-400">Before expenses</span>
            </div>
          </div>
        </div>

        {/* KPI 3: Net Profit (After Expenses & Returns) */}
        <div className={`bg-gradient-to-br from-slate-900 ${stats.trueNetProfit >= 0 ? 'to-emerald-950/40 border-emerald-500/30' : 'to-rose-950/40 border-rose-500/30'} border rounded-2xl p-4 shadow-lg space-y-2`}>
          <div className="flex items-center justify-between">
            <div className="flex items-center gap-1.5">
              <span className={`text-xs font-bold ${stats.trueNetProfit >= 0 ? 'text-emerald-400' : 'text-rose-400'} uppercase tracking-wider`}>
                Net Profit
              </span>
              <div className="group/tooltip relative cursor-pointer">
                <HelpCircle className="h-3.5 w-3.5 text-slate-400 hover:text-emerald-400 transition" />
                <div className="absolute left-0 bottom-full mb-2 hidden group-hover/tooltip:block w-72 p-3 bg-slate-950 border border-slate-700 rounded-xl text-xs text-slate-300 shadow-2xl z-50">
                  <p className="font-bold text-white mb-1">Net Profit Percentage Breakdown:</p>
                  <p className="text-[11px] text-teal-400">+ Gross Profit: {formatPKR(stats.grossProfit)} ({grossMarginPct}%)</p>
                  <p className="text-[11px] text-rose-400">- Return Losses: {formatPKR(stats.returnLoss)} ({returnLossPct}%)</p>
                  <p className="text-[11px] text-rose-400">- General Expenses: {formatPKR(stats.generalExpenses)} ({expensesPct}%)</p>
                  <div className="border-t border-slate-800 my-1 pt-1 font-bold text-white flex justify-between">
                    <span>Final Net Margin:</span>
                    <span className={stats.trueNetProfit >= 0 ? 'text-emerald-400' : 'text-rose-400'}>
                      {formatPKR(stats.trueNetProfit)} ({netMarginPct}%)
                    </span>
                  </div>
                </div>
              </div>
            </div>
            <div className={`h-8 w-8 rounded-xl ${stats.trueNetProfit >= 0 ? 'bg-emerald-500/20 text-emerald-400' : 'bg-rose-500/20 text-rose-400'} flex items-center justify-center`}>
              <TrendingUp className="h-4 w-4" />
            </div>
          </div>
          <div>
            <div className={`text-2xl font-black ${stats.trueNetProfit >= 0 ? 'text-emerald-400' : 'text-rose-400'}`}>
              {formatPKR(stats.trueNetProfit)}
            </div>
            <div className="flex items-center gap-1.5 mt-1">
              <span className={`px-2 py-0.5 rounded-full text-[10px] font-bold ${stats.trueNetProfit >= 0 ? 'bg-emerald-500/20 text-emerald-300 border border-emerald-500/30' : 'bg-rose-500/20 text-rose-300 border border-rose-500/30'}`}>
                {netMarginPct}% Net
              </span>
              <span className="text-[11px] text-slate-400">After expenses</span>
            </div>
          </div>
        </div>

        {/* KPI 4: Total Expenses */}
        <div className="bg-slate-900 border border-slate-800 rounded-2xl p-4 hover:border-slate-700 transition space-y-2">
          <div className="flex items-center justify-between">
            <span className="text-xs font-semibold text-slate-400">Total Expenses</span>
            <div className="h-8 w-8 rounded-xl bg-rose-500/10 text-rose-400 flex items-center justify-center">
              <Receipt className="h-4 w-4" />
            </div>
          </div>
          <div>
            <div className="text-2xl font-bold text-rose-400">{formatPKR(stats.generalExpenses)}</div>
            <div className="flex items-center gap-1.5 mt-1">
              <span className="px-2 py-0.5 rounded-full text-[10px] font-bold bg-rose-500/20 text-rose-300 border border-rose-500/30">
                {expensesPct}% Expense
              </span>
              <span className="text-[11px] text-slate-400">Of sales</span>
            </div>
          </div>
        </div>

        {/* KPI 5: Active Dispatches */}
        <div className="bg-slate-900 border border-slate-800 rounded-2xl p-4 hover:border-slate-700 transition space-y-2">
          <div className="flex items-center justify-between">
            <span className="text-xs font-semibold text-slate-400">Active Orders</span>
            <div className="h-8 w-8 rounded-xl bg-blue-500/10 text-blue-400 flex items-center justify-center">
              <Truck className="h-4 w-4" />
            </div>
          </div>
          <div>
            <div className="text-2xl font-bold text-blue-400">{stats.activeDispatches}</div>
            <p className="text-[11px] text-slate-400 mt-1">In transit ({stats.totalOrdersCount} total)</p>
          </div>
        </div>

        {/* KPI 6: Return Loss */}
        <div className="bg-slate-900 border border-slate-800 rounded-2xl p-4 hover:border-slate-700 transition space-y-2">
          <div className="flex items-center justify-between">
            <span className="text-xs font-semibold text-slate-400">Return Loss</span>
            <div className="h-8 w-8 rounded-xl bg-amber-500/10 text-amber-400 flex items-center justify-center">
              <RotateCcw className="h-4 w-4" />
            </div>
          </div>
          <div>
            <div className="text-2xl font-bold text-amber-400">{formatPKR(stats.returnLoss)}</div>
            <div className="flex items-center gap-1.5 mt-1">
              <span className="px-2 py-0.5 rounded-full text-[10px] font-bold bg-amber-500/20 text-amber-300 border border-amber-500/30">
                {returnLossPct}% Loss
              </span>
              <span className="text-[11px] text-slate-400">Courier penalty</span>
            </div>
          </div>
        </div>

      </div>

      {/* Profit Flow Summary Bar with % Badges */}
      <div className="bg-slate-900/90 border border-slate-800 rounded-2xl p-4 shadow-xl flex flex-col md:flex-row items-center justify-between gap-4 text-xs">
        <div>
          <h3 className="font-bold text-slate-200 text-sm">Profit Flow Pipeline</h3>
          <p className="text-[11px] text-slate-400">Financial reconciliation with percentage ratios</p>
        </div>

        <div className="flex flex-wrap items-center gap-2 font-mono">
          <div className="bg-slate-800/80 px-3 py-1.5 rounded-xl border border-slate-700">
            <span className="text-slate-400 block text-[10px]">Sales Revenue</span>
            <span className="font-bold text-slate-100">{formatPKR(stats.totalRevenue)} (100%)</span>
          </div>

          <span className="text-slate-500 font-bold text-sm">➔</span>

          <div className="bg-teal-500/10 px-3 py-1.5 rounded-xl border border-teal-500/30">
            <span className="text-teal-400 block text-[10px]">Overall Sales Profit</span>
            <span className="font-bold text-teal-400">{formatPKR(stats.grossProfit)} ({grossMarginPct}%)</span>
          </div>

          <span className="text-rose-400 font-bold text-sm">-</span>

          <div className="bg-rose-500/10 px-3 py-1.5 rounded-xl border border-rose-500/30">
            <span className="text-rose-400 block text-[10px]">Expenses + Returns</span>
            <span className="font-bold text-rose-400">{formatPKR(stats.totalExpensesCombined)} ({combinedExpPct}%)</span>
          </div>

          <span className="text-slate-500 font-bold text-sm">=</span>

          <div className={`px-3 py-1.5 rounded-xl border font-bold ${stats.trueNetProfit >= 0 ? 'bg-emerald-500/10 border-emerald-500/40 text-emerald-400' : 'bg-rose-500/10 border-rose-500/40 text-rose-400'}`}>
            <span className="block text-[10px]">Net Profit (After Expenses)</span>
            <span>{formatPKR(stats.trueNetProfit)} ({netMarginPct}%)</span>
          </div>
        </div>
      </div>

      {/* 2. Quick Actions Bar */}
      <div className="bg-slate-900 border border-slate-800 rounded-2xl p-5 shadow-xl flex flex-col sm:flex-row items-start sm:items-center justify-between gap-4">
        <div>
          <h2 className="text-base font-bold text-slate-100">Quick Actions</h2>
          <p className="text-xs text-slate-400">Frequently used business operations</p>
        </div>

        <div className="flex flex-wrap items-center gap-3 w-full sm:w-auto">
          <button
            onClick={onOpenNewDispatch}
            className="flex-1 sm:flex-initial px-4 py-2.5 bg-emerald-500 hover:bg-emerald-600 text-slate-950 font-bold text-xs rounded-xl flex items-center justify-center gap-2 transition shadow-md shadow-emerald-500/10"
          >
            <Sparkles className="h-4 w-4" />
            <span>New Order</span>
          </button>

          <button
            onClick={onOpenRestock}
            className="flex-1 sm:flex-initial px-4 py-2.5 bg-slate-800 hover:bg-slate-700 text-slate-200 border border-slate-700 text-xs font-semibold rounded-xl flex items-center justify-center gap-2 transition"
          >
            <PlusCircle className="h-4 w-4 text-emerald-400" />
            <span>Restock Inventory</span>
          </button>

          <button
            onClick={onOpenExpense}
            className="flex-1 sm:flex-initial px-4 py-2.5 bg-slate-800 hover:bg-slate-700 text-slate-200 border border-slate-700 text-xs font-semibold rounded-xl flex items-center justify-center gap-2 transition"
          >
            <Receipt className="h-4 w-4 text-rose-400" />
            <span>Add Expense</span>
          </button>
        </div>
      </div>

      {/* 3. Needs Attention Section */}
      {(hasLowStock || hasActiveDispatches || hasSupplierDebt || hasReturnLosses) && (
        <div className="space-y-3">
          <h3 className="text-sm font-bold text-slate-300 flex items-center gap-2">
            <AlertTriangle className="h-4 w-4 text-amber-400" /> Needs Attention
          </h3>

          <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-3">

            {hasLowStock && (
              <div className="bg-amber-500/10 border border-amber-500/20 rounded-xl p-3.5 flex justify-between items-center text-xs">
                <div>
                  <h4 className="font-bold text-amber-400">Low Stock Alert</h4>
                  <p className="text-slate-300 mt-0.5">{lowStockProductsCount} product(s) running low on stock.</p>
                </div>
                <button
                  onClick={onOpenRestock}
                  className="px-2.5 py-1 bg-amber-500 text-slate-950 font-bold rounded-lg shrink-0 ml-2"
                >
                  Restock
                </button>
              </div>
            )}

            {hasActiveDispatches && (
              <div className="bg-blue-500/10 border border-blue-500/20 rounded-xl p-3.5 flex justify-between items-center text-xs">
                <div>
                  <h4 className="font-bold text-blue-400">Pending Deliveries</h4>
                  <p className="text-slate-300 mt-0.5">{stats.activeDispatches} order(s) awaiting delivery confirmation.</p>
                </div>
                <button
                  onClick={onViewAllOrders}
                  className="px-2.5 py-1 bg-blue-500 text-white font-bold rounded-lg shrink-0 ml-2"
                >
                  Review
                </button>
              </div>
            )}

            {hasSupplierDebt && (
              <div className="bg-purple-500/10 border border-purple-500/20 rounded-xl p-3.5 flex justify-between items-center text-xs">
                <div>
                  <h4 className="font-bold text-purple-400">Supplier Payables Owed</h4>
                  <p className="text-slate-300 mt-0.5">Rs. {stats.totalSupplierDebt.toLocaleString()} unpaid supplier balance.</p>
                </div>
              </div>
            )}

          </div>
        </div>
      )}

      {/* 4. Recent Orders Table */}
      <div className="bg-slate-900 border border-slate-800 rounded-2xl p-6 shadow-xl space-y-4">
        <div className="flex justify-between items-center">
          <div>
            <h3 className="text-base font-bold text-slate-100">Recent Orders</h3>
            <p className="text-xs text-slate-400">Latest order dispatches and statuses</p>
          </div>
          <button
            onClick={onViewAllOrders}
            className="text-xs font-semibold text-emerald-400 hover:text-emerald-300 flex items-center gap-1 transition"
          >
            View All <ArrowUpRight className="h-3.5 w-3.5" />
          </button>
        </div>

        {recentSales.length === 0 ? (
          <div className="p-8 text-center border border-dashed border-slate-800 rounded-xl text-slate-500 text-xs">
            No orders found. Click &quot;New Order&quot; to start recording dispatches.
          </div>
        ) : (
          <div className="overflow-x-auto">
            <table className="w-full text-left text-xs text-slate-300">
              <thead className="bg-slate-950/60 text-slate-400 uppercase tracking-wider font-semibold border-b border-slate-800">
                <tr>
                  <th className="px-4 py-3">Order Item</th>
                  <th className="px-4 py-3">Customer</th>
                  <th className="px-4 py-3">City</th>
                  <th className="px-4 py-3">Amount</th>
                  <th className="px-4 py-3">Status</th>
                  <th className="px-4 py-3 text-right">Actions</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-slate-800/60">
                {recentSales.slice(0, 5).map((sale) => (
                  <tr key={sale.id} className="hover:bg-slate-800/40 transition cursor-pointer" onClick={() => onSelectOrder(sale)}>
                    <td className="px-4 py-3 font-semibold text-slate-100">{sale.productName}</td>
                    <td className="px-4 py-3 text-slate-200">{sale.customerName}</td>
                    <td className="px-4 py-3 text-slate-400">{sale.city}</td>
                    <td className="px-4 py-3 font-mono font-medium text-emerald-400">
                      {formatPKR(sale.soldPrice * sale.quantity)}
                    </td>
                    <td className="px-4 py-3">
                      <StatusBadge status={sale.status} />
                    </td>
                    <td className="px-4 py-3 text-right">
                      <button
                        onClick={(e) => {
                          e.stopPropagation()
                          onSelectOrder(sale)
                        }}
                        className="px-2.5 py-1 bg-slate-800 hover:bg-slate-700 text-slate-300 rounded-lg text-[11px] transition"
                      >
                        Details
                      </button>
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
