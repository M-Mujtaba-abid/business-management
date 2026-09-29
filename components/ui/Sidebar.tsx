'use client'

import React from 'react'
import {
  LayoutDashboard,
  ShoppingCart,
  // Package, // OLD INVENTORY FLOW (Inventory nav item)
  Receipt,
  Wallet,
  Settings,
  // PlusCircle, // OLD INVENTORY FLOW (Restock button)
  Plus,
  // RefreshCw, // SEED DEMO DATA button
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
  // onOpenRestock, // OLD INVENTORY FLOW (Restock button)
  onOpenExpense,
  // onSeedData, // SEED DEMO DATA button
  // isSeeding,
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
      label: 'Orders',
      icon: ShoppingCart,
    },
    {
      id: 'partners-suppliers' as NavSection,
      label: 'Payments',
      icon: Wallet,
    },
    /* OLD INVENTORY FLOW — uncomment to restore
    {
      id: 'inventory' as NavSection,
      label: 'Inventory & Stock',
      icon: Package,
    },
    */
    {
      id: 'finance' as NavSection,
      label: 'Expenses',
      icon: Receipt,
    },
    {
      id: 'settings' as NavSection,
      label: 'Settings',
      icon: Settings,
    },
  ]

  const handleNavClick = (section: NavSection) => {
    onSelectSection(section)
    onCloseMobile()
  }

  const sidebarContent = (
    <div className="h-full flex flex-col justify-between bg-white border-r border-slate-200 text-slate-800 w-60 p-4">
      <div className="space-y-6">

        {/* Brand Header */}
        <div className="flex items-center justify-between px-2 pt-1">
          <div className="flex items-center gap-2.5">
            <div className="h-9 w-9 rounded-xl bg-emerald-500 flex items-center justify-center shadow-sm">
              <ShoppingCart className="h-5 w-5 text-white" />
            </div>
            <div>
              <h1 className="text-sm font-bold text-slate-900 leading-tight">Business Manager</h1>
              <span className="text-[11px] text-slate-500">Orders & profit</span>
            </div>
          </div>

          {/* Mobile Close Button */}
          <button onClick={onCloseMobile} className="lg:hidden p-1 text-slate-500 hover:text-slate-900">
            <X className="h-5 w-5" />
          </button>
        </div>

        {/* Quick Actions */}
        <div className="space-y-2">
          <button
            onClick={() => {
              onOpenNewDispatch()
              onCloseMobile()
            }}
            className="w-full py-2.5 px-3 rounded-xl bg-emerald-500 hover:bg-emerald-600 text-white font-semibold text-sm flex items-center justify-center gap-2 transition shadow-sm"
          >
            <Plus className="h-4 w-4" /> New Order
          </button>

          {/* OLD INVENTORY FLOW — uncomment to restore
          <button
            onClick={() => {
              onOpenRestock()
              onCloseMobile()
            }}
            className="w-full py-2 px-3 rounded-xl bg-white hover:bg-slate-50 text-slate-700 font-medium text-xs flex items-center justify-center gap-1.5 border border-slate-200 transition"
          >
            <PlusCircle className="h-3.5 w-3.5 text-emerald-600" /> Restock
          </button>
          */}

          <button
            onClick={() => {
              onOpenExpense()
              onCloseMobile()
            }}
            className="w-full py-2 px-3 rounded-xl bg-white hover:bg-slate-50 text-slate-700 font-medium text-xs flex items-center justify-center gap-1.5 border border-slate-200 transition"
          >
            <Receipt className="h-3.5 w-3.5 text-rose-500" /> Add Expense
          </button>
        </div>

        {/* Navigation */}
        <nav className="space-y-1">
          <div className="px-2 text-[10px] font-semibold text-slate-400 uppercase tracking-wider mb-2">
            Menu
          </div>
          {navItems.map((item) => {
            const Icon = item.icon
            const isActive = currentSection === item.id
            return (
              <button
                key={item.id}
                onClick={() => handleNavClick(item.id)}
                className={`w-full flex items-center gap-2.5 px-3 py-2.5 rounded-xl text-sm font-medium transition ${
                  isActive
                    ? 'bg-emerald-50 text-emerald-700'
                    : 'text-slate-600 hover:text-slate-900 hover:bg-slate-50'
                }`}
              >
                <Icon className={`h-4 w-4 ${isActive ? 'text-emerald-600' : 'text-slate-400'}`} />
                <span>{item.label}</span>
              </button>
            )
          })}
        </nav>
      </div>

      {/* Footer */}
      <div className="pt-4 border-t border-slate-100 space-y-2">
        {/* SEED DEMO DATA — uncomment to restore
        <button
          onClick={onSeedData}
          disabled={isSeeding}
          className="w-full py-2 px-3 bg-white hover:bg-slate-50 text-slate-500 hover:text-slate-800 rounded-xl text-xs flex items-center justify-center gap-2 transition border border-slate-200"
        >
          <RefreshCw className={`h-3.5 w-3.5 ${isSeeding ? 'animate-spin' : ''}`} />
          <span>{isSeeding ? 'Seeding...' : 'Seed Demo Data'}</span>
        </button>
        */}

        <div className="text-[10px] text-slate-400 text-center">
          Connected to database
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
          <div className="fixed inset-0 bg-slate-900/30 backdrop-blur-sm" onClick={onCloseMobile} />
          <div className="fixed inset-y-0 left-0 z-50 animate-in slide-in-from-left duration-200">
            {sidebarContent}
          </div>
        </div>
      )}
    </>
  )
}
