'use client'

import React, { useState } from 'react'
import Sidebar, { NavSection } from './Sidebar'
import { Menu, Calendar, Sparkles } from 'lucide-react'

interface AppShellProps {
  currentSection: NavSection
  onSelectSection: (section: NavSection) => void
  dateRange: string
  setDateRange: (range: string) => void
  startDate?: string
  setStartDate?: (date: string) => void
  endDate?: string
  setEndDate?: (date: string) => void
  onOpenNewDispatch: () => void
  onOpenRestock: () => void
  onOpenExpense: () => void
  onSeedData: () => void
  isSeeding?: boolean
  children: React.ReactNode
}

export default function AppShell({
  currentSection,
  onSelectSection,
  dateRange,
  setDateRange,
  startDate = '',
  setStartDate,
  endDate = '',
  setEndDate,
  onOpenNewDispatch,
  onOpenRestock,
  onOpenExpense,
  onSeedData,
  isSeeding,
  children,
}: AppShellProps) {
  const [isMobileOpen, setIsMobileOpen] = useState(false)

  const getSectionTitle = () => {
    switch (currentSection) {
      case 'dashboard':
        return 'Business Health Overview'
      case 'orders':
        return 'Orders & Dispatches'
      case 'inventory':
        return 'Inventory & Product Catalog'
      case 'finance':
        return 'Financial Expenses & P&L'
      case 'partners-suppliers':
        return 'Partner Investments & Supplier Payables'
      case 'settings':
        return 'Settings & Delivery Rates'
      default:
        return 'Dashboard'
    }
  }

  // Current date fallback values
  const now = new Date()
  const currentYearNum = now.getFullYear()
  const yearsList = Array.from({ length: 4 }, (_, i) => (currentYearNum - i).toString())

  const monthsList = [
    { label: 'All Months', value: 'ALL' },
    { label: 'Jan', value: '01' },
    { label: 'Feb', value: '02' },
    { label: 'Mar', value: '03' },
    { label: 'Apr', value: '04' },
    { label: 'May', value: '05' },
    { label: 'Jun', value: '06' },
    { label: 'Jul', value: '07' },
    { label: 'Aug', value: '08' },
    { label: 'Sep', value: '09' },
    { label: 'Oct', value: '10' },
    { label: 'Nov', value: '11' },
    { label: 'Dec', value: '12' },
  ]

  // Determine active month & year from dateRange string
  let selectedMonth = 'ALL'
  let selectedYear = currentYearNum.toString()

  if (/^\d{4}-\d{2}$/.test(dateRange)) {
    const [y, m] = dateRange.split('-')
    selectedYear = y
    selectedMonth = m
  } else if (/^\d{4}$/.test(dateRange)) {
    selectedYear = dateRange
    selectedMonth = 'ALL'
  }

  const handleMonthChange = (mVal: string) => {
    if (setStartDate) setStartDate('')
    if (setEndDate) setEndDate('')
    if (mVal === 'ALL') {
      setDateRange(selectedYear)
    } else {
      setDateRange(`${selectedYear}-${mVal}`)
    }
  }

  const handleYearChange = (yVal: string) => {
    if (setStartDate) setStartDate('')
    if (setEndDate) setEndDate('')
    if (selectedMonth === 'ALL') {
      setDateRange(yVal)
    } else {
      setDateRange(`${yVal}-${selectedMonth}`)
    }
  }

  const handlePresetChange = (val: string) => {
    if (setStartDate) setStartDate('')
    if (setEndDate) setEndDate('')
    setDateRange(val)
  }

  return (
    <div className="min-h-screen bg-slate-950 text-slate-100 font-sans flex selection:bg-emerald-500 selection:text-slate-950">
      
      {/* Responsive Sidebar */}
      <Sidebar
        currentSection={currentSection}
        onSelectSection={onSelectSection}
        onOpenNewDispatch={onOpenNewDispatch}
        onOpenRestock={onOpenRestock}
        onOpenExpense={onOpenExpense}
        onSeedData={onSeedData}
        isSeeding={isSeeding}
        isMobileOpen={isMobileOpen}
        onCloseMobile={() => setIsMobileOpen(false)}
      />

      {/* Main Content Area */}
      <div className="flex-1 flex flex-col min-w-0">
        
        {/* Top Navbar */}
        <header className="sticky top-0 z-30 bg-slate-900/80 backdrop-blur-md border-b border-slate-800/80 px-4 sm:px-8 py-3.5 flex items-center justify-between gap-4">
          <div className="flex items-center gap-3">
            <button
              onClick={() => setIsMobileOpen(true)}
              className="lg:hidden p-2 rounded-xl bg-slate-800 text-slate-300 hover:text-white"
            >
              <Menu className="h-5 w-5" />
            </button>
            <div>
              <h1 className="text-base sm:text-lg font-bold text-slate-100">{getSectionTitle()}</h1>
              <p className="text-[11px] text-slate-400 hidden sm:block">Real-time financial analytics & dispatch operations</p>
            </div>
          </div>

          {/* Controls: Date Range Selector & New Dispatch Quick Action */}
          <div className="flex items-center gap-2 sm:gap-3 flex-wrap justify-end">
            
            {/* Filter Bar */}
            <div className="flex items-center gap-1.5 bg-slate-800/80 border border-slate-700/60 rounded-xl p-1 text-xs overflow-x-auto flex-wrap">
              <Calendar className="h-3.5 w-3.5 text-slate-400 ml-1.5 mr-1 hidden md:block shrink-0" />
              
              {/* Quick Presets */}
              {[
                { label: 'Today', value: 'today' },
                { label: 'This Week', value: 'week' },
                { label: 'All Time', value: 'all' },
              ].map((btn) => (
                <button
                  key={btn.value}
                  onClick={() => handlePresetChange(btn.value)}
                  className={`px-2 py-1 rounded-lg transition font-medium text-[11px] whitespace-nowrap ${
                    dateRange === btn.value && !startDate && !endDate
                      ? 'bg-emerald-500 text-slate-950 font-bold shadow-sm'
                      : 'text-slate-400 hover:text-slate-200'
                  }`}
                >
                  {btn.label}
                </button>
              ))}

              <div className="h-4 w-px bg-slate-700/80 mx-0.5 hidden sm:block" />

              {/* Month Dropdown */}
              <select
                value={selectedMonth}
                onChange={(e) => handleMonthChange(e.target.value)}
                className={`bg-slate-900 border border-slate-700 rounded-lg px-2 py-1 text-[11px] font-semibold transition focus:outline-none focus:border-emerald-500 ${
                  (dateRange.includes('-') || dateRange === 'month') && !startDate && !endDate ? 'text-emerald-400 border-emerald-500/50' : 'text-slate-300'
                }`}
              >
                {monthsList.map((m) => (
                  <option key={m.value} value={m.value}>
                    {m.label}
                  </option>
                ))}
              </select>

              {/* Year Dropdown */}
              <select
                value={selectedYear}
                onChange={(e) => handleYearChange(e.target.value)}
                className="bg-slate-900 border border-slate-700 rounded-lg px-2 py-1 text-[11px] font-semibold text-slate-300 transition focus:outline-none focus:border-emerald-500"
              >
                {yearsList.map((y) => (
                  <option key={y} value={y}>
                    {y}
                  </option>
                ))}
              </select>

              <div className="h-4 w-px bg-slate-700/80 mx-0.5 hidden sm:block" />

              {/* Custom Date Inputs (Start & End Date) */}
              <div className="flex items-center gap-1 bg-slate-950/70 border border-slate-700/80 rounded-lg px-2 py-0.5">
                <span className="text-[10px] text-slate-400 font-semibold">From:</span>
                <input
                  type="date"
                  value={startDate}
                  onChange={(e) => {
                    if (setStartDate) setStartDate(e.target.value)
                  }}
                  className="bg-transparent text-[11px] text-emerald-400 font-mono focus:outline-none [color-scheme:dark] w-24 sm:w-auto"
                />
                <span className="text-[10px] text-slate-400 font-semibold">To:</span>
                <input
                  type="date"
                  value={endDate}
                  onChange={(e) => {
                    if (setEndDate) setEndDate(e.target.value)
                  }}
                  className="bg-transparent text-[11px] text-emerald-400 font-mono focus:outline-none [color-scheme:dark] w-24 sm:w-auto"
                />
                {(startDate || endDate) && (
                  <button
                    onClick={() => {
                      if (setStartDate) setStartDate('')
                      if (setEndDate) setEndDate('')
                      setDateRange('all')
                    }}
                    className="text-slate-400 hover:text-rose-400 text-xs ml-1 font-bold transition"
                    title="Clear custom date filter"
                  >
                    ✕
                  </button>
                )}
              </div>
            </div>

            {/* Quick Order Button */}
            <button
              onClick={onOpenNewDispatch}
              className="hidden sm:flex px-3.5 py-1.5 rounded-xl bg-emerald-500 hover:bg-emerald-600 text-slate-950 font-bold text-xs items-center gap-1.5 transition shadow-md shadow-emerald-500/10"
            >
              <Sparkles className="h-3.5 w-3.5" />
              <span>New Order</span>
            </button>
          </div>
        </header>

        {/* Dynamic Main Body */}
        <main className="flex-1 max-w-7xl w-full mx-auto p-4 sm:p-6 lg:p-8 space-y-6">
          {children}
        </main>

        {/* Footer */}
        <footer className="border-t border-slate-800/60 py-4 px-6 text-center text-[11px] text-slate-500">
          Business Manager ERP v2.0 • Powered by Next.js 14, Prisma & Neon PostgreSQL
        </footer>

      </div>

    </div>
  )
}
