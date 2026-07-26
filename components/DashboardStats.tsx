'use client'

import React from 'react'
import {
  TrendingUp,
  DollarSign,
  Receipt,
  Truck,
  Users,
  CreditCard,
  HelpCircle,
} from 'lucide-react'

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
  isLoading?: boolean
}

export default function DashboardStats({ stats, isLoading }: StatsProps) {
  const formatPKR = (amount: number) => {
    return new Intl.NumberFormat('en-PK', {
      style: 'currency',
      currency: 'PKR',
      maximumFractionDigits: 0,
    }).format(amount)
  }

  if (isLoading) {
    return (
      <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 xl:grid-cols-6 gap-4 mb-8">
        {[...Array(6)].map((_, i) => (
          <div key={i} className="h-32 bg-slate-800/50 rounded-xl animate-pulse border border-slate-700/50" />
        ))}
      </div>
    )
  }

  return (
    <div className="space-y-4 mb-8">
      {/* Primary KPI Grid */}
      <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 xl:grid-cols-6 gap-4">
        
        {/* 1. Total Revenue */}
        <div className="bg-slate-900/90 border border-slate-800 rounded-xl p-4 relative overflow-hidden group hover:border-slate-700 transition">
          <div className="flex items-center justify-between">
            <span className="text-xs font-medium text-slate-400">Total Revenue</span>
            <div className="h-8 w-8 rounded-lg bg-emerald-500/10 text-emerald-400 flex items-center justify-center">
              <DollarSign className="h-4 w-4" />
            </div>
          </div>
          <div className="mt-3">
            <div className="text-2xl font-bold text-slate-100">{formatPKR(stats.totalRevenue)}</div>
            <p className="text-[11px] text-slate-400 mt-1">From Delivered sales</p>
          </div>
        </div>

        {/* 2. True Net Profit (Highlighted) */}
        <div className="bg-gradient-to-br from-slate-900 via-slate-900 to-emerald-950/40 border border-emerald-500/30 rounded-xl p-4 relative overflow-hidden group shadow-lg shadow-emerald-950/20">
          <div className="flex items-center justify-between">
            <div className="flex items-center gap-1">
              <span className="text-xs font-bold text-emerald-400 uppercase tracking-wider">True Net Profit</span>
              <div className="group/tooltip relative cursor-pointer">
                <HelpCircle className="h-3.5 w-3.5 text-slate-400 hover:text-emerald-400 transition" />
                <div className="absolute left-0 bottom-full mb-2 hidden group-hover/tooltip:block w-64 p-3 bg-slate-950 border border-slate-700 rounded-lg text-xs text-slate-300 shadow-xl z-50">
                  <p className="font-bold text-white mb-1">True Net Profit Formula:</p>
                  <p className="text-[11px]">Gross Profit ({formatPKR(stats.grossProfit)})</p>
                  <p className="text-[11px] text-rose-400">- Return Losses ({formatPKR(stats.returnLoss)})</p>
                  <p className="text-[11px] text-rose-400">- Expenses ({formatPKR(stats.generalExpenses)})</p>
                </div>
              </div>
            </div>
            <div className="h-8 w-8 rounded-lg bg-emerald-500/20 text-emerald-400 flex items-center justify-center font-bold">
              <TrendingUp className="h-4 w-4" />
            </div>
          </div>
          <div className="mt-3">
            <div className={`text-2xl font-black ${stats.trueNetProfit >= 0 ? 'text-emerald-400' : 'text-rose-400'}`}>
              {formatPKR(stats.trueNetProfit)}
            </div>
            <div className="flex items-center gap-1 text-[11px] text-slate-400 mt-1">
              <span>Gross: {formatPKR(stats.grossProfit)}</span>
            </div>
          </div>
        </div>

        {/* 3. Total Expenses & Losses */}
        <div className="bg-slate-900/90 border border-slate-800 rounded-xl p-4 relative overflow-hidden group hover:border-slate-700 transition">
          <div className="flex items-center justify-between">
            <span className="text-xs font-medium text-slate-400">Total Expenses</span>
            <div className="h-8 w-8 rounded-lg bg-rose-500/10 text-rose-400 flex items-center justify-center">
              <Receipt className="h-4 w-4" />
            </div>
          </div>
          <div className="mt-3">
            <div className="text-2xl font-bold text-rose-400">{formatPKR(stats.totalExpensesCombined)}</div>
            <p className="text-[11px] text-slate-400 mt-1">
              General: {formatPKR(stats.generalExpenses)} | Returns: {formatPKR(stats.returnLoss)}
            </p>
          </div>
        </div>

        {/* 4. Active Dispatches */}
        <div className="bg-slate-900/90 border border-slate-800 rounded-xl p-4 relative overflow-hidden group hover:border-slate-700 transition">
          <div className="flex items-center justify-between">
            <span className="text-xs font-medium text-slate-400">Active Dispatches</span>
            <div className="h-8 w-8 rounded-lg bg-amber-500/10 text-amber-400 flex items-center justify-center">
              <Truck className="h-4 w-4" />
            </div>
          </div>
          <div className="mt-3">
            <div className="text-2xl font-bold text-amber-400">{stats.activeDispatches}</div>
            <p className="text-[11px] text-slate-400 mt-1">Pending in transit ({stats.totalOrdersCount} total orders)</p>
          </div>
        </div>

        {/* 5. Partner Equity Cards */}
        <div className="bg-slate-900/90 border border-slate-800 rounded-xl p-4 relative overflow-hidden group hover:border-slate-700 transition">
          <div className="flex items-center justify-between">
            <span className="text-xs font-medium text-slate-400">Partner Equity</span>
            <div className="h-8 w-8 rounded-lg bg-blue-500/10 text-blue-400 flex items-center justify-center">
              <Users className="h-4 w-4" />
            </div>
          </div>
          <div className="mt-3 space-y-1">
            {stats.partners && stats.partners.length > 0 ? (
              stats.partners.map((partner) => (
                <div key={partner.id} className="flex justify-between text-xs">
                  <span className="text-slate-300 font-medium">{partner.name}:</span>
                  <span className="text-blue-400 font-semibold">{formatPKR(partner.totalCapitalInvested)}</span>
                </div>
              ))
            ) : (
              <p className="text-xs text-slate-400">No partners initialized</p>
            )}
          </div>
        </div>

        {/* 6. Supplier Debt */}
        <div className="bg-slate-900/90 border border-slate-800 rounded-xl p-4 relative overflow-hidden group hover:border-slate-700 transition">
          <div className="flex items-center justify-between">
            <span className="text-xs font-medium text-slate-400">Supplier Debt</span>
            <div className="h-8 w-8 rounded-lg bg-purple-500/10 text-purple-400 flex items-center justify-center">
              <CreditCard className="h-4 w-4" />
            </div>
          </div>
          <div className="mt-3">
            <div className="text-2xl font-bold text-purple-400">{formatPKR(stats.totalSupplierDebt)}</div>
            <p className="text-[11px] text-slate-400 mt-1">Unpaid supplier balance</p>
          </div>
        </div>

      </div>
    </div>
  )
}
