'use client'

import React, { useState } from 'react'
import Sidebar, { NavSection } from './Sidebar'
import { Menu, Calendar, Plus, ChevronDown } from 'lucide-react'

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
  const [isFilterOpen, setIsFilterOpen] = useState(false)

  const getSectionTitle = () => {
    switch (currentSection) {
      case 'dashboard':
        return 'Dashboard'
      case 'orders':
        return 'Orders'
      case 'inventory':
        return 'Inventory & Product Catalog'
      case 'finance':
        return 'Expenses'
      case 'partners-suppliers':
        return 'Payments'
      case 'settings':
        return 'Settings'
      default:
        return 'Dashboard'
    }
  }

  const getSectionSubtitle = () => {
    switch (currentSection) {
      case 'dashboard':
        return 'Sales, profit and what needs attention'
      case 'orders':
        return 'Track every order from dispatch to delivery'
      case 'finance':
        return 'General business costs like ads and packaging'
      case 'partners-suppliers':
        return 'Who has the money, what is still to come, and what you owe suppliers'
      case 'settings':
        return 'Categories and delivery rates'
      default:
        return ''
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

  const isCustom = Boolean(startDate || endDate)
  const isAllTime = !isCustom && dateRange === 'all'
  const monthName = (m: string) => monthsList.find((x) => x.value === m)?.label || m
  const activeRangeLabel = isCustom
    ? 'Custom'
    : dateRange === 'today'
    ? 'Today'
    : dateRange === 'week'
    ? 'This week'
    : dateRange === 'month'
    ? 'This month'
    : /^\d{4}-\d{2}$/.test(dateRange)
    ? `${monthName(dateRange.split('-')[1])} ${dateRange.split('-')[0]}`
    : /^\d{4}$/.test(dateRange)
    ? dateRange
    : 'All time'

  const dateFilter = (
    <div className="flex flex-wrap items-center gap-2 text-xs">
      {/* Quick Presets */}
      <div className="flex items-center gap-1 bg-slate-100 rounded-xl p-1">
        {[
          { label: 'Today', value: 'today' },
          { label: 'This Week', value: 'week' },
          { label: 'All Time', value: 'all' },
        ].map((btn) => (
          <button
            key={btn.value}
            onClick={() => handlePresetChange(btn.value)}
            className={`px-2.5 py-1.5 rounded-lg transition font-medium text-xs whitespace-nowrap ${
              dateRange === btn.value && !isCustom
                ? 'bg-white text-emerald-700 font-semibold shadow-sm'
                : 'text-slate-600 hover:text-slate-900'
            }`}
          >
            {btn.label}
          </button>
        ))}
      </div>

      {/* Month & Year */}
      <div className="flex items-center gap-1">
        <select
          value={selectedMonth}
          onChange={(e) => handleMonthChange(e.target.value)}
          className={`bg-white border border-slate-300 rounded-lg px-2 py-1.5 text-xs font-semibold transition focus:outline-none focus:border-emerald-500 ${
            (dateRange.includes('-') || dateRange === 'month') && !isCustom ? 'text-emerald-600 border-emerald-500/50' : 'text-slate-700'
          }`}
        >
          {monthsList.map((m) => (
            <option key={m.value} value={m.value}>
              {m.label}
            </option>
          ))}
        </select>
        <select
          value={selectedYear}
          onChange={(e) => handleYearChange(e.target.value)}
          className="bg-white border border-slate-300 rounded-lg px-2 py-1.5 text-xs font-semibold text-slate-700 transition focus:outline-none focus:border-emerald-500"
        >
          {yearsList.map((y) => (
            <option key={y} value={y}>
              {y}
            </option>
          ))}
        </select>
      </div>

      {/* Custom Date Inputs (Start & End Date) */}
      <div className="flex items-center gap-1.5 bg-slate-50 border border-slate-200 rounded-lg px-2 py-1 w-full sm:w-auto">
        <span className="text-[11px] text-slate-500 font-semibold">From</span>
        <input
          type="date"
          value={startDate}
          onChange={(e) => {
            if (setStartDate) setStartDate(e.target.value)
          }}
          className="bg-transparent text-xs text-emerald-700 font-mono focus:outline-none min-w-0 flex-1 sm:flex-none"
        />
        <span className="text-[11px] text-slate-500 font-semibold">To</span>
        <input
          type="date"
          value={endDate}
          onChange={(e) => {
            if (setEndDate) setEndDate(e.target.value)
          }}
          className="bg-transparent text-xs text-emerald-700 font-mono focus:outline-none min-w-0 flex-1 sm:flex-none"
        />
        {isCustom && (
          <button
            onClick={() => {
              if (setStartDate) setStartDate('')
              if (setEndDate) setEndDate('')
              setDateRange('all')
            }}
            className="text-slate-500 hover:text-rose-600 text-sm px-1 font-bold transition"
            title="Clear custom date filter"
          >
            ✕
          </button>
        )}
      </div>
    </div>
  )

  return (
    <div className="min-h-screen bg-slate-50 text-slate-900 font-sans flex selection:bg-emerald-500 selection:text-white">
      
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
      <div className="flex-1 flex flex-col min-w-0 overflow-x-hidden">
        
        {/* Top Navbar */}
        <header className="sticky top-0 z-30 bg-white/95 backdrop-blur-md border-b border-slate-200">
          <div className="px-3 sm:px-6 lg:px-8 py-3 flex items-center justify-between gap-2">
            <div className="flex items-center gap-2 sm:gap-3 min-w-0">
              <button
                onClick={() => setIsMobileOpen(true)}
                className="lg:hidden p-2 rounded-xl bg-slate-100 text-slate-700 hover:text-slate-900 shrink-0"
                aria-label="Open menu"
              >
                <Menu className="h-5 w-5" />
              </button>
              <div className="min-w-0">
                <h1 className="text-base sm:text-lg font-bold text-slate-900 truncate">{getSectionTitle()}</h1>
                <p className="text-[11px] text-slate-500 hidden sm:block truncate">{getSectionSubtitle()}</p>
              </div>
            </div>

            <div className="flex items-center gap-2 shrink-0">
              {/* Inline date filter on wide screens */}
              <div className="hidden xl:block">{dateFilter}</div>

              {/* Date filter toggle on phones / tablets */}
              <button
                onClick={() => setIsFilterOpen((o) => !o)}
                className={`xl:hidden flex items-center gap-1.5 px-2.5 py-2 rounded-xl border text-xs font-semibold transition ${
                  isFilterOpen || !isAllTime
                    ? 'bg-emerald-50 border-emerald-200 text-emerald-700'
                    : 'bg-white border-slate-200 text-slate-600'
                }`}
                aria-label="Date filter"
              >
                <Calendar className="h-4 w-4" />
                <span className="max-w-[88px] truncate">{activeRangeLabel}</span>
                <ChevronDown className={`h-3.5 w-3.5 transition ${isFilterOpen ? 'rotate-180' : ''}`} />
              </button>

              {/* Quick Order Button */}
              <button
                onClick={onOpenNewDispatch}
                className="flex p-2 sm:px-3.5 sm:py-2 rounded-xl bg-emerald-500 hover:bg-emerald-600 text-white font-bold text-xs items-center gap-1.5 transition shadow-sm"
                aria-label="New Order"
              >
                <Plus className="h-4 w-4" />
                <span className="hidden sm:inline">New Order</span>
              </button>
            </div>
          </div>

          {/* Date filter panel on phones / tablets */}
          {isFilterOpen && (
            <div className="xl:hidden border-t border-slate-100 px-3 sm:px-6 py-3 bg-white">{dateFilter}</div>
          )}
        </header>

        {/* Dynamic Main Body */}
        <main className="flex-1 max-w-7xl w-full mx-auto px-3 py-4 sm:p-6 lg:p-8 space-y-4 sm:space-y-6">
          {children}
        </main>

        {/* Footer */}
        <footer className="border-t border-slate-200 py-4 px-6 text-center text-[11px] text-slate-500">
          Business Manager
        </footer>

      </div>

    </div>
  )
}
