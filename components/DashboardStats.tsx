'use client'

import React, { memo, useMemo } from 'react'
import {
  TrendingUp,
  TrendingDown,
  DollarSign,
  Receipt,
  Truck,
  AlertTriangle,
  // PlusCircle, // OLD INVENTORY FLOW (Restock button)
  ArrowUpRight,
  RotateCcw,
  Wallet,
  Recycle,
  Banknote,
  Activity,
  CheckCircle2,
} from 'lucide-react'
import StatusBadge from './ui/StatusBadge'
import { Sale, SupplierPayBadge, PaymentBadge } from './OrderList'
import { groupSales, OrderGroup } from '@/lib/parcels'
import { formatDateTime } from '@/lib/format'
import { useCountUp, formatPKR } from './charts/hooks'
import Sparkline from './charts/Sparkline'
import MiniBars from './charts/MiniBars'
import WaterfallChart, { WaterfallStep } from './charts/WaterfallChart'
import TrendChart from './charts/TrendChart'
import DonutChart from './charts/DonutChart'

interface Partner {
  id: string
  name: string
  totalCapitalInvested: number
}

export interface TrendPoint {
  date: string
  sales: number
  orderProfit: number
  expenses: number
  returnLoss: number
  orders: number
  netProfit: number
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
    supplierOverdue?: boolean
    returnedItemsCount?: number
    orderExpenses?: number
    paymentFees?: number
    receivablePendingTotal?: number
    receivablePendingCount?: number
    expenseBreakdown?: { label: string; amount: number }[]
    trend?: TrendPoint[]
    trendGranularity?: 'day' | 'month'
    salesChangePct?: number | null
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

// Categorical palette (validated for light mode); fixed order, never cycled
const C = {
  blue: '#2a78d6',
  orange: '#eb6834',
  aqua: '#1baf7a',
  yellow: '#eda100',
  magenta: '#e87ba4',
  green: '#008300',
  red: '#e34948',
}
const DONUT_COLORS = [C.blue, C.orange, C.aqua, C.yellow, C.magenta, C.green]

const pct = (part: number, base: number) => (base > 0 ? ((part / base) * 100).toFixed(1) : '0.0')

// Money that counts up to its value when it appears / changes
const Money = memo(function Money({ value, className }: { value: number; className?: string }) {
  const shown = useCountUp(value)
  return <span className={className}>{formatPKR(shown)}</span>
})

const Count = memo(function Count({ value, className }: { value: number; className?: string }) {
  const shown = useCountUp(value)
  return <span className={className}>{Math.round(shown).toLocaleString()}</span>
})

const card = 'bg-white border border-slate-200 rounded-2xl shadow-sm viz-card'

export default function DashboardStats({
  stats,
  recentSales = [],
  // lowStockProductsCount = 0, // OLD INVENTORY FLOW (low stock alert)
  isLoading,
  // onOpenNewDispatch, onOpenExpense: quick actions live in the sidebar only
  // onOpenRestock, // OLD INVENTORY FLOW (Restock button)
  onSelectOrder,
  onViewAllOrders,
  onViewSupplierPayments,
}: StatsProps) {
  const trend = stats.trend
  const hasData = Array.isArray(trend)

  const recentGroups = useMemo(() => groupSales(recentSales).slice(0, 6), [recentSales])
  const groupTitle = (g: OrderGroup) =>
    (g.lead.orderNo ? `#${g.lead.orderNo} · ` : '') +
    (g.items.length === 1 ? g.lead.productName : `${g.items.length} items: ${g.items.map((i) => i.productName).join(', ')}`)

  // Chart inputs are derived once per stats change, not on every render
  const series = useMemo(() => {
    const t = trend || []
    return {
      dates: t.map((p) => p.date),
      sales: t.map((p) => p.sales),
      orderProfit: t.map((p) => p.orderProfit),
      netProfit: t.map((p) => p.netProfit),
      expenses: t.map((p) => p.expenses),
      returnLoss: t.map((p) => p.returnLoss),
      orders: t.map((p) => p.orders),
    }
  }, [trend])

  const trendSeries = useMemo(
    () => [
      { key: 'sales', label: 'Sales', color: C.blue, values: series.sales },
      { key: 'expenses', label: 'Expenses', color: C.orange, values: series.expenses },
      { key: 'net', label: 'Net Profit', color: C.aqua, values: series.netProfit },
    ],
    [series]
  )

  const orderExpenses = stats.orderExpenses || 0
  const paymentFees = stats.paymentFees || 0 // tax / fees cut by Daraz, couriers, etc.
  const coverCost = Math.max(0, stats.totalRevenue - stats.grossProfit - orderExpenses - paymentFees)
  const netPositive = stats.trueNetProfit >= 0

  const waterfall: WaterfallStep[] = useMemo(
    (): WaterfallStep[] => [
      { label: 'Sales', value: stats.totalRevenue, kind: 'total', color: C.blue },
      { label: 'Cover cost', value: coverCost, kind: 'down', color: C.orange },
      { label: 'DC / Petrol / GST', value: orderExpenses, kind: 'down', color: C.orange },
      // Only shown when Daraz / courier payouts were cut (or topped up)
      ...(Math.abs(paymentFees) >= 0.5
        ? [{ label: 'Payment cuts', value: paymentFees, kind: 'down' as const, color: C.orange }]
        : []),
      { label: 'Order Profit', value: stats.grossProfit, kind: 'total', color: C.aqua },
      { label: 'Expenses', value: stats.generalExpenses, kind: 'down', color: C.orange },
      { label: 'Return loss', value: stats.returnLoss, kind: 'down', color: C.orange },
      { label: 'Net Profit', value: stats.trueNetProfit, kind: 'total', color: netPositive ? C.green : C.red },
    ],
    [stats.totalRevenue, coverCost, orderExpenses, paymentFees, stats.grossProfit, stats.generalExpenses, stats.returnLoss, stats.trueNetProfit, netPositive]
  )

  // Skeleton only on the very first load; later refreshes keep the charts on screen
  if (isLoading && !hasData) {
    return (
      <div className="space-y-4">
        <div className="grid grid-cols-1 sm:grid-cols-3 gap-4">
          {[...Array(3)].map((_, i) => (
            <div key={i} className="h-28 bg-white border border-slate-200 rounded-2xl animate-pulse" />
          ))}
        </div>
        <div className="grid grid-cols-1 xl:grid-cols-4 gap-4">
          <div className="h-80 bg-white border border-slate-200 rounded-2xl animate-pulse" />
          <div className="h-80 xl:col-span-2 bg-white border border-slate-200 rounded-2xl animate-pulse" />
          <div className="h-80 bg-white border border-slate-200 rounded-2xl animate-pulse" />
        </div>
      </div>
    )
  }

  const supplierPending = stats.supplierPendingTotal || 0
  const returnedItemsCount = stats.returnedItemsCount || 0
  const toReceive = stats.receivablePendingTotal || 0
  const toReceiveCount = stats.receivablePendingCount || 0
  const hasToReceive = toReceive > 0
  const hasActiveDispatches = stats.activeDispatches > 0
  const hasSupplierPending = supplierPending > 0
  const hasReturnedStock = returnedItemsCount > 0
  const change = stats.salesChangePct
  /* OLD INVENTORY FLOW — uncomment to restore
  const hasLowStock = lowStockProductsCount > 0
  const hasSupplierDebt = stats.totalSupplierDebt > 0
  */

  const trendLabel =
    stats.trendGranularity === 'month' ? `Last ${series.dates.length} months` : `Last ${series.dates.length} days`

  return (
    <div className="space-y-4">

      {/* ── Row 1: headline numbers ───────────────────────────── */}
      <div className="grid grid-cols-1 sm:grid-cols-3 gap-4">
        {/* Sales */}
        <div className={`${card} p-4 sm:p-5 flex items-center gap-4`}>
          <div className="h-12 w-12 rounded-2xl bg-blue-50 text-blue-600 flex items-center justify-center shrink-0">
            <DollarSign className="h-6 w-6" />
          </div>
          <div className="min-w-0">
            <div className="text-sm text-slate-500">Sales</div>
            <Money value={stats.totalRevenue} className="block text-2xl font-bold text-slate-900 truncate" />
            {change !== null && change !== undefined ? (
              <div className={`text-xs font-medium flex items-center gap-1 ${change >= 0 ? 'text-emerald-600' : 'text-rose-600'}`}>
                {change >= 0 ? <TrendingUp className="h-3.5 w-3.5" /> : <TrendingDown className="h-3.5 w-3.5" />}
                {Math.abs(change).toFixed(1)}% <span className="text-slate-400 font-normal">vs previous period</span>
              </div>
            ) : (
              <div className="text-xs text-slate-400">From delivered orders</div>
            )}
          </div>
        </div>

        {/* Order profit */}
        <div className={`${card} p-4 sm:p-5`} style={{ animationDelay: '60ms' }}>
          <div className="flex items-start justify-between gap-2">
            <div className="text-sm text-slate-500">Order Profit</div>
            <div className="h-8 w-8 rounded-xl bg-teal-50 text-teal-600 flex items-center justify-center">
              <TrendingUp className="h-4 w-4" />
            </div>
          </div>
          <div className="flex items-end justify-between gap-2">
            <div className="min-w-0">
              <Money value={stats.grossProfit} className="block text-2xl font-bold text-teal-700 truncate" />
              <div className="text-xs text-slate-500">
                <span className="font-semibold text-teal-700">{pct(stats.grossProfit, stats.totalRevenue)}%</span> margin · after DC, petrol, GST
              </div>
            </div>
            <Sparkline values={series.orderProfit} color={C.aqua} className="h-10 w-24 shrink-0" />
          </div>
        </div>

        {/* Net profit */}
        <div className={`${card} p-4 sm:p-5`} style={{ animationDelay: '120ms' }}>
          <div className="flex items-start justify-between gap-2">
            <div className="text-sm text-slate-500">Net Profit</div>
            <div className={`h-8 w-8 rounded-xl flex items-center justify-center ${netPositive ? 'bg-emerald-50 text-emerald-600' : 'bg-rose-50 text-rose-600'}`}>
              <Activity className="h-4 w-4" />
            </div>
          </div>
          <div className="flex items-end justify-between gap-2">
            <div className="min-w-0">
              <Money
                value={stats.trueNetProfit}
                className={`block text-2xl font-bold truncate ${netPositive ? 'text-emerald-700' : 'text-rose-600'}`}
              />
              <div className="text-xs text-slate-500">
                <span className="font-semibold">{pct(stats.trueNetProfit, stats.totalRevenue)}%</span> · after expenses & returns
              </div>
            </div>
            <Sparkline values={series.netProfit} color={netPositive ? C.green : C.red} className="h-10 w-24 shrink-0" />
          </div>
        </div>
      </div>

      {/* ── Row 2: money flow + profit breakdown ─────────────── */}
      <div className="grid grid-cols-1 sm:grid-cols-2 xl:grid-cols-4 gap-4">

        {/* Left column */}
        <div className="grid grid-cols-1 gap-4 content-start">
          <button
            onClick={onViewSupplierPayments}
            className={`${card} text-left p-4 sm:p-5 border-emerald-200 bg-gradient-to-br from-emerald-50 to-white hover:border-emerald-300 transition`}
          >
            <div className="flex items-start justify-between">
              <span className="text-sm font-medium text-emerald-800">To Receive</span>
              <div className="h-8 w-8 rounded-xl bg-white border border-emerald-200 text-emerald-600 flex items-center justify-center">
                <Banknote className="h-4 w-4" />
              </div>
            </div>
            <Money value={toReceive} className="block text-2xl font-bold text-emerald-700 mt-1" />
            <div className="text-xs text-slate-500 flex items-center gap-1">
              {hasToReceive ? `${toReceiveCount} delivered order(s) not paid yet` : 'All payments received'}
              <ArrowUpRight className="h-3 w-3" />
            </div>
          </button>

          <div className={`${card} p-4 flex items-center gap-3`}>
            <div className="h-10 w-10 rounded-full bg-blue-50 text-blue-600 flex items-center justify-center shrink-0">
              <Truck className="h-5 w-5" />
            </div>
            <div className="flex-1 min-w-0">
              <div className="text-xs text-slate-500">Active Orders</div>
              <Count value={stats.activeDispatches} className="block text-xl font-bold text-slate-900" />
              <div className="text-[11px] text-slate-400">{stats.totalOrdersCount} total</div>
            </div>
            <MiniBars values={series.orders} color={C.blue} />
          </div>

          <div className={`${card} p-4 flex items-center gap-3`}>
            <div className="h-10 w-10 rounded-full bg-rose-50 text-rose-600 flex items-center justify-center shrink-0">
              <Receipt className="h-5 w-5" />
            </div>
            <div className="flex-1 min-w-0">
              <div className="text-xs text-slate-500">Expenses</div>
              <Money value={stats.generalExpenses} className="block text-xl font-bold text-slate-900 truncate" />
              <div className="text-[11px] text-slate-400">{pct(stats.generalExpenses, stats.totalRevenue)}% of sales</div>
            </div>
            <MiniBars values={series.expenses} color={C.orange} />
          </div>
        </div>

        {/* Profit breakdown (center) */}
        <div className={`${card} p-4 sm:p-5 sm:col-span-2 order-first sm:order-last xl:order-none flex flex-col min-h-[340px]`}>
          <div className="flex items-center justify-between mb-2">
            <h3 className="text-sm font-semibold text-slate-900">Profit breakdown</h3>
            <span className="text-[11px] text-slate-400">tap a bar for details</span>
          </div>
          <div className="flex-1">
            <WaterfallChart steps={waterfall} base={stats.totalRevenue} />
          </div>
        </div>

        {/* Right column */}
        <div className="grid grid-cols-1 gap-4 content-start">
          <button
            onClick={onViewSupplierPayments}
            className={`${card} text-left p-4 sm:p-5 transition ${stats.supplierOverdue
              ? 'border-amber-300 bg-gradient-to-br from-amber-50 to-white ring-2 ring-amber-200/60'
              : 'border-amber-200 bg-gradient-to-br from-amber-50/60 to-white hover:border-amber-300'
              }`}
          >
            <div className="flex items-start justify-between gap-2">
              <div>
                <div className="flex items-center gap-2">
                  <span className="text-sm font-medium text-amber-900">Owed to Suppliers</span>
                  {stats.supplierOverdue && (
                    <span className="px-1.5 py-0.5 rounded-md text-[10px] font-bold bg-amber-100 text-amber-800 border border-amber-300">
                      overdue
                    </span>
                  )}
                </div>
                <div className="text-[11px] text-slate-500">Total pending payments to suppliers</div>
              </div>
              <div className="h-8 w-8 rounded-xl bg-white border border-amber-200 text-amber-600 flex items-center justify-center shrink-0">
                <Wallet className="h-4 w-4" />
              </div>
            </div>
            <Money value={supplierPending} className={`block text-2xl font-bold mt-1 ${hasSupplierPending ? 'text-amber-700' : 'text-slate-900'}`} />
            <div className="text-xs text-slate-500 flex items-center gap-1">
              {hasSupplierPending ? 'Pending payments' : 'All paid'} <ArrowUpRight className="h-3 w-3" />
            </div>
          </button>

          <div className={`${card} p-4 flex items-center gap-3`}>
            <div className="h-10 w-10 rounded-full bg-orange-50 text-orange-600 flex items-center justify-center shrink-0">
              <RotateCcw className="h-5 w-5" />
            </div>
            <div className="flex-1 min-w-0">
              <div className="text-xs text-slate-500">Return Loss</div>
              <Money value={stats.returnLoss} className="block text-xl font-bold text-slate-900 truncate" />
              <div className="text-[11px] text-slate-400">{pct(stats.returnLoss, stats.totalRevenue)}% of sales</div>
            </div>
            <MiniBars values={series.returnLoss} color={C.yellow} />
          </div>

          <div className={`${card} p-4 flex items-center gap-3`}>
            <div className="h-10 w-10 rounded-full bg-emerald-50 text-emerald-600 flex items-center justify-center shrink-0">
              <Recycle className="h-5 w-5" />
            </div>
            <div className="flex-1 min-w-0">
              <div className="text-xs text-slate-500">Returned Stock</div>
              <Count value={returnedItemsCount} className="block text-xl font-bold text-slate-900" />
              <div className="text-[11px] text-slate-400">covers ready to reuse</div>
            </div>
          </div>
        </div>
      </div>

      {/* ── Row 3: trend, expense mix, attention ─────────────── */}
      <div className="grid grid-cols-1 sm:grid-cols-2 xl:grid-cols-3 gap-4">
        {/* Sales trend */}
        <div className={`${card} p-4 sm:p-5`}>
          <div className="flex items-center justify-between mb-2">
            <h3 className="text-sm font-semibold text-slate-900">Sales trend</h3>
            <span className="text-[11px] text-slate-400">{trendLabel}</span>
          </div>
          <TrendChart
            dates={series.dates}
            series={trendSeries}
            granularity={stats.trendGranularity || 'day'}
          />
        </div>

        {/* Expense breakdown */}
        <div className={`${card} p-4 sm:p-5`}>
          <h3 className="text-sm font-semibold text-slate-900 mb-3">Expense breakdown</h3>
          <DonutChart items={stats.expenseBreakdown || []} colors={DONUT_COLORS} />
        </div>

        {/* Needs attention */}
        <div className={`${card} p-4 sm:p-5 space-y-3`}>
          <h3 className="text-sm font-semibold text-slate-900 flex items-center gap-2">
            <AlertTriangle className="h-4 w-4 text-amber-500" /> Needs attention
          </h3>

          {!hasActiveDispatches && !hasSupplierPending && !hasReturnedStock && !hasToReceive ? (
            <div className="flex flex-col items-center text-center py-6 text-slate-500">
              <CheckCircle2 className="h-8 w-8 text-emerald-500 mb-2" />
              <p className="text-sm">All clear. Nothing needs attention.</p>
            </div>
          ) : (
            <div className="space-y-2">
              {hasActiveDispatches && (
                <button
                  onClick={onViewAllOrders}
                  className="w-full text-left flex items-center justify-between gap-2 rounded-xl border border-blue-200 bg-blue-50 px-3 py-2.5 text-xs hover:border-blue-300 transition"
                >
                  <span className="flex items-center gap-2 text-blue-900 min-w-0">
                    <Truck className="h-4 w-4 shrink-0 text-blue-600" />
                    <span className="truncate"><b>{stats.activeDispatches}</b> order(s) waiting for delivery</span>
                  </span>
                  <span className="font-semibold text-blue-700 underline shrink-0">Review</span>
                </button>
              )}

              {hasToReceive && (
                <button
                  onClick={onViewSupplierPayments}
                  className="w-full text-left flex items-center justify-between gap-2 rounded-xl border border-emerald-200 bg-emerald-50 px-3 py-2.5 text-xs hover:border-emerald-300 transition"
                >
                  <span className="flex items-center gap-2 text-emerald-900 min-w-0">
                    <Banknote className="h-4 w-4 shrink-0 text-emerald-600" />
                    <span className="truncate"><b>{formatPKR(toReceive)}</b> not received yet</span>
                  </span>
                  <span className="font-semibold text-emerald-700 underline shrink-0">View</span>
                </button>
              )}

              {hasSupplierPending && (
                <button
                  onClick={onViewSupplierPayments}
                  className="w-full text-left flex items-center justify-between gap-2 rounded-xl border border-amber-200 bg-amber-50 px-3 py-2.5 text-xs hover:border-amber-300 transition"
                >
                  <span className="flex items-center gap-2 text-amber-900 min-w-0">
                    <Wallet className="h-4 w-4 shrink-0 text-amber-600" />
                    <span className="truncate"><b>{formatPKR(supplierPending)}</b> still owed to suppliers</span>
                  </span>
                  <span className="font-semibold text-amber-700 underline shrink-0">View</span>
                </button>
              )}

              {hasReturnedStock && (
                <div className="flex items-center gap-2 rounded-xl border border-slate-200 bg-slate-50 px-3 py-2.5 text-xs text-slate-700">
                  <Recycle className="h-4 w-4 shrink-0 text-emerald-600" />
                  <span><b>{returnedItemsCount}</b> returned cover(s) ready to reuse</span>
                </div>
              )}

              {/* OLD INVENTORY FLOW — uncomment to restore
              {hasLowStock && (
                <div className="rounded-xl border border-amber-100 bg-amber-50 px-3 py-2.5 text-xs text-amber-800">
                  {lowStockProductsCount} product(s) running low on stock
                </div>
              )}
              {hasSupplierDebt && (
                <div className="rounded-xl border border-purple-100 bg-purple-50 px-3 py-2.5 text-xs text-purple-800">
                  Rs. {stats.totalSupplierDebt.toLocaleString()} unpaid supplier balance (restock credit)
                </div>
              )}
              */}
            </div>
          )}
        </div>
      </div>

      {/* ── Row 4: recent orders ──────────────────────────────── */}
      <div className={`${card} p-4 sm:p-5 space-y-4`}>
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
            No orders yet. Use &quot;New Order&quot; in the sidebar to add your first one.
          </div>
        ) : (
          <>
            {/* Phones: compact list */}
            <div className="md:hidden divide-y divide-slate-100">
              {recentGroups.map(({ lead: sale, ...g }) => (
                <button
                  key={g.key}
                  onClick={() => onSelectOrder(sale)}
                  className="w-full text-left py-3 flex items-start justify-between gap-3 active:bg-slate-50"
                >
                  <div className="min-w-0">
                    <div className="font-medium text-sm text-slate-900 truncate">{groupTitle({ lead: sale, ...g })}</div>
                    <div className="text-[11px] text-slate-500 truncate">
                      {[formatDateTime(sale.createdAt, true), sale.orderSource?.name, g.supplierNames.join(', ')].filter(Boolean).join(' · ')}
                    </div>
                    <div className="flex flex-wrap gap-1 mt-1.5">
                      <StatusBadge status={sale.status} />
                      <PaymentBadge status={sale.paymentStatus} />
                    </div>
                  </div>
                  <div className="text-right shrink-0">
                    <div className="font-semibold text-sm text-slate-900">{formatPKR(g.saleTotal)}</div>
                    <div className="text-[11px] text-slate-500">Profit {formatPKR(g.profit)}</div>
                  </div>
                </button>
              ))}
            </div>

            {/* Tablet / desktop: table */}
            <div className="hidden md:block overflow-x-auto">
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
                  {recentGroups.map(({ lead: sale, ...g }) => (
                    <tr key={g.key} className="hover:bg-slate-50 transition cursor-pointer" onClick={() => onSelectOrder(sale)}>
                      <td className="px-3 py-3 max-w-[260px]">
                        <div className="font-medium text-slate-900 truncate">{groupTitle({ lead: sale, ...g })}</div>
                        <div className="text-xs text-slate-500">
                          {[formatDateTime(sale.createdAt, true), sale.orderSource?.name, g.items.length === 1 ? sale.category?.name : null]
                            .filter(Boolean)
                            .join(' · ')}
                        </div>
                      </td>
                      <td className="px-3 py-3 text-slate-600">
                        {g.supplierNames.join(', ') || '—'}
                      </td>
                      <td className="px-3 py-3">
                        <div className="font-semibold text-slate-900">{formatPKR(g.saleTotal)}</div>
                        <div className="text-xs text-slate-500">Profit {formatPKR(g.profit)}</div>
                      </td>
                      <td className="px-3 py-3">
                        <StatusBadge status={sale.status} />
                      </td>
                      <td className="px-3 py-3">
                        <PaymentBadge status={sale.paymentStatus} />
                      </td>
                      <td className="px-3 py-3">
                        <SupplierPayBadge
                          status={g.supplierTracked === 0 ? 'NOT_APPLICABLE' : g.supplierPending > 0 ? 'PENDING' : 'PAID'}
                        />
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          </>
        )}
      </div>

    </div>
  )
}
