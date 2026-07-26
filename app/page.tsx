'use client'

import { useState, useEffect, useCallback } from 'react'
import Header from '@/components/Header'
import DashboardStats from '@/components/DashboardStats'
import OrderList, { Sale } from '@/components/OrderList'
import NewSaleModal from '@/components/NewSaleModal'
import MarkReturnedModal from '@/components/MarkReturnedModal'
import InventoryModal from '@/components/InventoryModal'
import ExpenseModal from '@/components/ExpenseModal'
import InventoryTab from '@/components/InventoryTab'
import ExpensesTab from '@/components/ExpensesTab'
import CityRatesTab from '@/components/CityRatesTab'
import LedgerTab from '@/components/LedgerTab'
import { Toaster, toast } from 'sonner'
import { ShoppingCart, Package, Receipt, MapPin, Users } from 'lucide-react'

export default function Home() {
  const [activeTab, setActiveTab] = useState<'sales' | 'inventory' | 'expenses' | 'cities' | 'ledger'>('sales')
  const [dateRange, setDateRange] = useState<string>('all')
  const [statusFilter, setStatusFilter] = useState<string>('ALL')
  const [searchQuery, setSearchQuery] = useState<string>('')

  // State Data
  const [sales, setSales] = useState<Sale[]>([])
  const [stats, setStats] = useState({
    totalRevenue: 0,
    grossProfit: 0,
    returnLoss: 0,
    generalExpenses: 0,
    trueNetProfit: 0,
    totalExpensesCombined: 0,
    activeDispatches: 0,
    totalOrdersCount: 0,
    partners: [],
    suppliers: [],
    totalSupplierDebt: 0,
  })

  // Loading States
  const [isStatsLoading, setIsStatsLoading] = useState(true)
  const [isSalesLoading, setIsSalesLoading] = useState(true)
  const [isSeeding, setIsSeeding] = useState(false)

  // Modal Open States
  const [isNewSaleOpen, setIsNewSaleOpen] = useState(false)
  const [isRestockOpen, setIsRestockOpen] = useState(false)
  const [isExpenseOpen, setIsExpenseOpen] = useState(false)
  const [returnModalSale, setReturnModalSale] = useState<Sale | null>(null)

  // Fetch KPI Stats
  const fetchStats = useCallback(async () => {
    setIsStatsLoading(true)
    try {
      const res = await fetch(`/api/stats?range=${dateRange}`)
      if (res.ok) {
        const data = await res.json()
        setStats(data)
      }
    } catch (err) {
      console.error('Failed to fetch stats:', err)
    } finally {
      setIsStatsLoading(false)
    }
  }, [dateRange])

  // Fetch Sales List
  const fetchSales = useCallback(async () => {
    setIsSalesLoading(true)
    try {
      let url = `/api/sales?range=${dateRange}&status=${statusFilter}`
      if (searchQuery) {
        url += `&search=${encodeURIComponent(searchQuery)}`
      }
      const res = await fetch(url)
      if (res.ok) {
        const data = await res.json()
        setSales(data)
      }
    } catch (err) {
      console.error('Failed to fetch sales:', err)
    } finally {
      setIsSalesLoading(false)
    }
  }, [dateRange, statusFilter, searchQuery])

  // Trigger Refresh
  const refreshAll = useCallback(() => {
    fetchStats()
    fetchSales()
  }, [fetchStats, fetchSales])

  useEffect(() => {
    refreshAll()
  }, [refreshAll])

  // Seed Data Handler
  const handleSeedData = async () => {
    setIsSeeding(true)
    try {
      const res = await fetch('/api/seed')
      const data = await res.json()
      if (res.ok) {
        toast.success(data.message || 'Database seeded successfully!')
        refreshAll()
      } else {
        toast.error(data.error || 'Failed to seed database')
      }
    } catch (err) {
      toast.error('Seed error occurred')
    } finally {
      setIsSeeding(false)
    }
  }

  // Handle Quick Order Status Change (e.g. DELIVERED or CANCELLED)
  const handleUpdateStatus = async (id: string, status: string, deductDeliveryOnReturn?: boolean) => {
    try {
      const res = await fetch(`/api/sales/${id}`, {
        method: 'PATCH',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ status, deductDeliveryOnReturn }),
      })

      if (!res.ok) {
        const errData = await res.json()
        throw new Error(errData.error || 'Failed to update order status')
      }

      toast.success(`Order marked as ${status}!`)
      refreshAll()
    } catch (err: any) {
      toast.error(err.message || 'Failed to update status')
    }
  }

  // Handle Delete Sale
  const handleDeleteSale = async (id: string) => {
    if (!confirm('Are you sure you want to delete this sale record?')) return

    try {
      const res = await fetch(`/api/sales/${id}`, {
        method: 'DELETE',
      })

      if (!res.ok) throw new Error('Failed to delete sale')

      toast.success('Sale deleted successfully')
      refreshAll()
    } catch (err: any) {
      toast.error(err.message || 'Failed to delete sale')
    }
  }

  return (
    <div className="min-h-screen bg-slate-950 text-slate-100 font-sans selection:bg-emerald-500 selection:text-slate-950">
      
      {/* Toast Notification Container */}
      <Toaster position="top-right" theme="dark" richColors />

      {/* Navigation Header */}
      <Header
        dateRange={dateRange}
        setDateRange={setDateRange}
        onOpenNewSale={() => setIsNewSaleOpen(true)}
        onOpenExpense={() => setIsExpenseOpen(true)}
        onOpenRestock={() => setIsRestockOpen(true)}
        onSeedData={handleSeedData}
        isSeeding={isSeeding}
      />

      {/* Main Body Layout */}
      <main className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 py-8 space-y-6">
        
        {/* KPI Summary Grid */}
        <DashboardStats stats={stats} isLoading={isStatsLoading} />

        {/* Interactive Main Tabs */}
        <div className="border-b border-slate-800 flex items-center gap-2 overflow-x-auto">
          {[
            { id: 'sales', label: 'Dispatches & Sales', icon: ShoppingCart },
            { id: 'inventory', label: 'Inventory & Stock', icon: Package },
            { id: 'expenses', label: 'Expenses Portal', icon: Receipt },
            { id: 'cities', label: 'City Delivery Rates', icon: MapPin },
            { id: 'ledger', label: 'Partners & Suppliers Ledger', icon: Users },
          ].map((tab) => {
            const Icon = tab.icon
            const isActive = activeTab === tab.id
            return (
              <button
                key={tab.id}
                onClick={() => setActiveTab(tab.id as any)}
                className={`flex items-center gap-2 px-4 py-3 text-xs sm:text-sm font-semibold border-b-2 transition whitespace-nowrap ${
                  isActive
                    ? 'border-emerald-400 text-emerald-400 bg-emerald-500/5 rounded-t-lg'
                    : 'border-transparent text-slate-400 hover:text-slate-200 hover:bg-slate-900/50'
                }`}
              >
                <Icon className="h-4 w-4" />
                {tab.label}
              </button>
            )
          })}
        </div>

        {/* Tab View Content */}
        <div>
          {activeTab === 'sales' && (
            <OrderList
              sales={sales}
              isLoading={isSalesLoading}
              searchQuery={searchQuery}
              setSearchQuery={setSearchQuery}
              statusFilter={statusFilter}
              setStatusFilter={setStatusFilter}
              onUpdateStatus={handleUpdateStatus}
              onOpenReturnModal={(sale) => setReturnModalSale(sale)}
              onDeleteSale={handleDeleteSale}
            />
          )}

          {activeTab === 'inventory' && (
            <InventoryTab onOpenRestock={() => setIsRestockOpen(true)} />
          )}

          {activeTab === 'expenses' && (
            <ExpensesTab onOpenExpenseModal={() => setIsExpenseOpen(true)} />
          )}

          {activeTab === 'cities' && <CityRatesTab />}

          {activeTab === 'ledger' && <LedgerTab />}
        </div>

      </main>

      {/* Global Modals */}
      <NewSaleModal
        isOpen={isNewSaleOpen}
        onClose={() => setIsNewSaleOpen(false)}
        onSuccess={() => {
          toast.success('Order dispatched successfully!')
          refreshAll()
        }}
      />

      <InventoryModal
        isOpen={isRestockOpen}
        onClose={() => setIsRestockOpen(false)}
        onSuccess={() => {
          toast.success('Stock restocked successfully!')
          refreshAll()
        }}
      />

      <ExpenseModal
        isOpen={isExpenseOpen}
        onClose={() => setIsExpenseOpen(false)}
        onSuccess={() => {
          toast.success('Expense recorded successfully!')
          refreshAll()
        }}
      />

      <MarkReturnedModal
        isOpen={Boolean(returnModalSale)}
        sale={returnModalSale}
        onClose={() => setReturnModalSale(null)}
        onConfirm={(saleId, deductLoss) => {
          handleUpdateStatus(saleId, 'RETURNED', deductLoss)
          setReturnModalSale(null)
        }}
      />

      {/* Footer */}
      <footer className="border-t border-slate-800/80 mt-16 py-6 text-center text-xs text-slate-500">
        <div className="max-w-7xl mx-auto px-4">
          Business Manager ERP v2.0 • Powered by Next.js 14, Prisma & Neon PostgreSQL
        </div>
      </footer>

    </div>
  )
}
