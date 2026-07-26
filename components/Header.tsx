'use client'

import React from 'react'
import { PlusCircle, ShoppingCart, Receipt, Calendar, Sparkles, RefreshCw } from 'lucide-react'

interface HeaderProps {
  dateRange: string
  setDateRange: (range: string) => void
  onOpenNewSale: () => void
  onOpenExpense: () => void
  onOpenRestock: () => void
  onSeedData: () => void
  isSeeding?: boolean
}

export default function Header({
  dateRange,
  setDateRange,
  onOpenNewSale,
  onOpenExpense,
  onOpenRestock,
  onSeedData,
  isSeeding,
}: HeaderProps) {
  return (
    <header className="bg-slate-900 border-b border-slate-800 text-white sticky top-0 z-30 shadow-lg">
      <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 py-4">
        <div className="flex flex-col md:flex-row md:items-center md:justify-between gap-4">
          
          {/* Logo & Title */}
          <div className="flex items-center gap-3">
            <div className="h-10 w-10 rounded-xl bg-gradient-to-tr from-emerald-500 to-teal-400 flex items-center justify-center shadow-lg shadow-emerald-500/20">
              <ShoppingCart className="h-6 w-6 text-slate-950 font-bold" />
            </div>
            <div>
              <div className="flex items-center gap-2">
                <h1 className="text-xl font-bold bg-gradient-to-r from-white via-slate-200 to-slate-400 bg-clip-text text-transparent">
                  Business ERP Manager
                </h1>
                <span className="text-xs px-2 py-0.5 rounded-full bg-emerald-500/10 text-emerald-400 border border-emerald-500/20 font-medium">
                  v2.0 Real-time
                </span>
              </div>
              <p className="text-xs text-slate-400">Sales, Inventory, Partner Equity & Profit Accounting</p>
            </div>
          </div>

          {/* Controls & Quick Actions */}
          <div className="flex flex-wrap items-center gap-2 sm:gap-3">
            
            {/* Date Range Selector */}
            <div className="flex items-center bg-slate-800/80 border border-slate-700/60 rounded-lg p-1 text-xs">
              <Calendar className="h-3.5 w-3.5 text-slate-400 ml-2 mr-1" />
              {[
                { label: 'Today', value: 'today' },
                { label: 'This Week', value: 'week' },
                { label: 'This Month', value: 'month' },
                { label: 'All Time', value: 'all' },
              ].map((btn) => (
                <button
                  key={btn.value}
                  onClick={() => setDateRange(btn.value)}
                  className={`px-2.5 py-1 rounded-md transition font-medium ${
                    dateRange === btn.value
                      ? 'bg-slate-700 text-white shadow-sm'
                      : 'text-slate-400 hover:text-slate-200'
                  }`}
                >
                  {btn.label}
                </button>
              ))}
            </div>

            {/* Seed Demo Data Button */}
            <button
              onClick={onSeedData}
              disabled={isSeeding}
              title="Seed initial partners and demo products"
              className="p-2 rounded-lg bg-slate-800 hover:bg-slate-700 text-slate-300 text-xs border border-slate-700/80 flex items-center gap-1 transition"
            >
              <RefreshCw className={`h-3.5 w-3.5 ${isSeeding ? 'animate-spin' : ''}`} />
              <span className="hidden sm:inline">Seed</span>
            </button>

            {/* Action Buttons */}
            <button
              onClick={onOpenRestock}
              className="px-3 py-2 rounded-lg bg-slate-800 hover:bg-slate-700 border border-slate-700 text-slate-200 font-medium text-xs sm:text-sm flex items-center gap-1.5 transition shadow-sm"
            >
              <PlusCircle className="h-4 w-4 text-emerald-400" />
              Restock
            </button>

            <button
              onClick={onOpenExpense}
              className="px-3 py-2 rounded-lg bg-slate-800 hover:bg-slate-700 border border-slate-700 text-slate-200 font-medium text-xs sm:text-sm flex items-center gap-1.5 transition shadow-sm"
            >
              <Receipt className="h-4 w-4 text-rose-400" />
              Add Expense
            </button>

            <button
              onClick={onOpenNewSale}
              className="px-3.5 py-2 rounded-lg bg-gradient-to-r from-emerald-500 to-teal-600 hover:from-emerald-600 hover:to-teal-700 text-slate-950 font-bold text-xs sm:text-sm flex items-center gap-1.5 transition shadow-md shadow-emerald-500/10"
            >
              <Sparkles className="h-4 w-4" />
              New Dispatch
            </button>

          </div>

        </div>
      </div>
    </header>
  )
}
