'use client'

import React from 'react'
import {
  LayoutDashboard,
  ShoppingCart,
  Package,
  Receipt,
  Users,
  Settings,
  PlusCircle,
  Sparkles,
  RefreshCw,
  X,
} from 'lucide-react'

export type NavSection =
  | 'dashboard'
  | 'orders'
  | 'inventory'
  | 'finance'
  | 'partners-suppliers'
  | 'settings'

interface SidebarProps {
  currentSection: NavSection
  onSelectSection: (section: NavSection) => void
  onOpenNewDispatch: () => void
  onOpenRestock: () => void
  onOpenExpense: () => void
  onSeedData: () => void
  isSeeding?: boolean
  isMobileOpen: boolean
  onCloseMobile: () => void
}

export default function Sidebar({
  currentSection,
  onSelectSection,
  onOpenNewDispatch,
  onOpenRestock,
  onOpenExpense,
  onSeedData,
  isSeeding,
  isMobileOpen,
  onCloseMobile,
}: SidebarProps) {
  const navItems = [
    {
      id: 'dashboard' as NavSection,
      label: 'Dashboard',
      icon: LayoutDashboard,
    },
    {
      id: 'orders' as NavSection,
      label: 'Orders & Dispatches',
      icon: ShoppingCart,
      badge: null,
    },
    {
      id: 'inventory' as NavSection,
      label: 'Inventory & Stock',
      icon: Package,
    },
    {
      id: 'finance' as NavSection,
      label: 'Finance & Expenses',
      icon: Receipt,
    },
    {
      id: 'partners-suppliers' as NavSection,
      label: 'Partners & Suppliers',
      icon: Users,
    },
    {
      id: 'settings' as NavSection,
      label: 'Settings & Config',
      icon: Settings,
    },
  ]

  const handleNavClick = (section: NavSection) => {
    onSelectSection(section)
    onCloseMobile()
  }

  const sidebarContent = (
    <div className="h-full flex flex-col justify-between bg-slate-900 border-r border-slate-800/80 text-slate-200 w-64 p-4">
      <div className="space-y-6">
        
        {/* Brand Header */}
        <div className="flex items-center justify-between px-2 pt-1">
          <div className="flex items-center gap-3">
            <div className="h-9 w-9 rounded-xl bg-gradient-to-tr from-emerald-500 to-teal-400 flex items-center justify-center shadow-lg shadow-emerald-500/20">
              <ShoppingCart className="h-5 w-5 text-slate-950 font-bold" />
            </div>
            <div>
              <h1 className="text-base font-bold text-slate-100 leading-none">Business ERP</h1>
              <span className="text-[10px] text-emerald-400 font-medium tracking-wide">SaaS v2.0</span>
            </div>
          </div>

          {/* Mobile Close Button */}
          <button onClick={onCloseMobile} className="lg:hidden p-1 text-slate-400 hover:text-white">
            <X className="h-5 w-5" />
          </button>
        </div>

        {/* Quick Actions Drop-in */}
        <div className="space-y-1.5 pt-2">
          <button
            onClick={() => {
              onOpenNewDispatch()
              onCloseMobile()
            }}
            className="w-full py-2 px-3 rounded-xl bg-emerald-500 hover:bg-emerald-600 text-slate-950 font-bold text-xs flex items-center justify-center gap-2 transition shadow-md shadow-emerald-500/10"
          >
            <Sparkles className="h-4 w-4" /> New Dispatch
          </button>

          <div className="grid grid-cols-2 gap-1.5">
            <button
              onClick={() => {
                onOpenRestock()
                onCloseMobile()
              }}
              className="py-1.5 px-2 rounded-lg bg-slate-800 hover:bg-slate-700 text-slate-300 font-semibold text-[11px] flex items-center justify-center gap-1 border border-slate-700/60 transition"
            >
              <PlusCircle className="h-3.5 w-3.5 text-emerald-400" /> Restock
            </button>
            <button
              onClick={() => {
                onOpenExpense()
                onCloseMobile()
              }}
              className="py-1.5 px-2 rounded-lg bg-slate-800 hover:bg-slate-700 text-slate-300 font-semibold text-[11px] flex items-center justify-center gap-1 border border-slate-700/60 transition"
            >
              <Receipt className="h-3.5 w-3.5 text-rose-400" /> Expense
            </button>
          </div>
        </div>

        {/* Navigation Section Links */}
        <nav className="space-y-1 pt-2">
          <div className="px-2 text-[10px] font-semibold text-slate-500 uppercase tracking-wider mb-2">
            Main Navigation
          </div>
          {navItems.map((item) => {
            const Icon = item.icon
            const isActive = currentSection === item.id
            return (
              <button
                key={item.id}
                onClick={() => handleNavClick(item.id)}
                className={`w-full flex items-center justify-between px-3 py-2.5 rounded-xl text-xs font-semibold transition ${
                  isActive
                    ? 'bg-emerald-500/10 text-emerald-400 border border-emerald-500/20'
                    : 'text-slate-400 hover:text-slate-200 hover:bg-slate-800/50'
                }`}
              >
                <div className="flex items-center gap-2.5">
                  <Icon className={`h-4 w-4 ${isActive ? 'text-emerald-400' : 'text-slate-400'}`} />
                  <span>{item.label}</span>
                </div>
              </button>
            )
          })}
        </nav>
      </div>

      {/* Footer / Demo Seed Button */}
      <div className="pt-4 border-t border-slate-800/80 space-y-2">
        <button
          onClick={onSeedData}
          disabled={isSeeding}
          className="w-full py-2 px-3 bg-slate-800 hover:bg-slate-700/80 text-slate-400 hover:text-slate-200 rounded-xl text-xs flex items-center justify-center gap-2 transition border border-slate-700/50"
        >
          <RefreshCw className={`h-3.5 w-3.5 ${isSeeding ? 'animate-spin' : ''}`} />
          <span>{isSeeding ? 'Seeding...' : 'Seed Demo Data'}</span>
        </button>

        <div className="text-[10px] text-slate-500 text-center">
          Connected to Neon Database
        </div>
      </div>
    </div>
  )

  return (
    <>
      {/* Desktop Persistent Sidebar */}
      <div className="hidden lg:block h-screen sticky top-0 shrink-0">
        {sidebarContent}
      </div>

      {/* Mobile Drawer Sheet */}
      {isMobileOpen && (
        <div className="fixed inset-0 z-50 lg:hidden">
          <div className="fixed inset-0 bg-slate-950/80 backdrop-blur-sm" onClick={onCloseMobile} />
          <div className="fixed inset-y-0 left-0 z-50 animate-in slide-in-from-left duration-200">
            {sidebarContent}
          </div>
        </div>
      )}
    </>
  )
}
