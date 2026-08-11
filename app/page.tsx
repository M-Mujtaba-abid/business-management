'use client'

import { useState, useEffect, useCallback } from 'react'
import AppShell from '@/components/ui/AppShell'
import { NavSection } from '@/components/ui/Sidebar'
import DashboardStats from '@/components/DashboardStats'
import OrderList, { Sale } from '@/components/OrderList'
import OrderDetailsDrawer from '@/components/ui/OrderDetailsDrawer'
import NewDispatchWizard from '@/components/ui/NewDispatchWizard'
import RestockWizard from '@/components/ui/RestockWizard'
import ExpenseWizard from '@/components/ui/ExpenseWizard'
import MarkReturnedModal from '@/components/MarkReturnedModal'
import InventoryTab from '@/components/InventoryTab'
import ExpensesTab from '@/components/ExpensesTab'
import CityRatesTab from '@/components/CityRatesTab'
import LedgerTab from '@/components/LedgerTab'
import { Toaster, toast } from 'sonner'

export default function Home() {
  const [activeSection, setActiveSection] = useState<NavSection>('dashboard')
  const [dateRange, setDateRange] = useState<string>('all')
  const [statusFilter, setStatusFilter] = useState<string>('ALL')
  const [searchQuery, setSearchQuery] = useState<string>('')

  // State Data
  const [sales, setSales] = useState<Sale[]>([])
  const [lowStockCount, setLowStockCount] = useState<number>(0)
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
    totalSupplierDebt: 0,
  })

  // Loading States
  const [isStatsLoading, setIsStatsLoading] = useState(true)
  const [isSalesLoading, setIsSalesLoading] = useState(true)
  const [isSeeding, setIsSeeding] = useState(false)

  // Modals & Drawers
  const [isNewDispatchOpen, setIsNewDispatchOpen] = useState(false)
  const [isRestockOpen, setIsRestockOpen] = useState(false)
  const [isExpenseOpen, setIsExpenseOpen] = useState(false)
  const [selectedDrawerSale, setSelectedDrawerSale] = useState<Sale | null>(null)
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

  // Fetch Low Stock Count for Alert
  const fetchLowStockCount = useCallback(async () => {
    try {
      const res = await fetch('/api/products')
      if (res.ok) {
        const prods = await res.json()
        if (Array.isArray(prods)) {
          const low = prods.filter((p: any) => p.stockQty < 5).length
          setLowStockCount(low)
        }
      }
    } catch (err) {
      console.error(err)
    }
  }, [])

  // Trigger Refresh
  const refreshAll = useCallback(() => {
    fetchStats()
    fetchSales()
    fetchLowStockCount()
  }, [fetchStats, fetchSales, fetchLowStockCount])

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

  // Handle Quick Order Status Change
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
    if (!confirm('Are you sure you want to delete this order record?')) return

    try {
      const res = await fetch(`/api/sales/${id}`, {
        method: 'DELETE',
      })

      if (!res.ok) throw new Error('Failed to delete order')

      toast.success('Order deleted successfully')
      refreshAll()
    } catch (err: any) {
      toast.error(err.message || 'Failed to delete order')
    }
  }

  return (
    <AppShell
      currentSection={activeSection}
      onSelectSection={setActiveSection}
      dateRange={dateRange}
      setDateRange={setDateRange}
      onOpenNewDispatch={() => setIsNewDispatchOpen(true)}
      onOpenRestock={() => setIsRestockOpen(true)}
      onOpenExpense={() => setIsExpenseOpen(true)}
      onSeedData={handleSeedData}
      isSeeding={isSeeding}
    >
      <Toaster position="top-right" theme="dark" richColors />

      {/* Render Active View */}
      {activeSection === 'dashboard' && (
        <DashboardStats
          stats={stats}
          recentSales={sales}
          lowStockProductsCount={lowStockCount}
          isLoading={isStatsLoading}
          onOpenNewDispatch={() => setIsNewDispatchOpen(true)}
          onOpenRestock={() => setIsRestockOpen(true)}
          onOpenExpense={() => setIsExpenseOpen(true)}
          onSelectOrder={(sale) => setSelectedDrawerSale(sale)}
          onViewAllOrders={() => setActiveSection('orders')}
        />
      )}

      {activeSection === 'orders' && (
        <OrderList
          sales={sales}
          isLoading={isSalesLoading}
          searchQuery={searchQuery}
          setSearchQuery={setSearchQuery}
          statusFilter={statusFilter}
          setStatusFilter={setStatusFilter}
          onSelectOrder={(sale) => setSelectedDrawerSale(sale)}
        />
      )}

      {activeSection === 'inventory' && (
        <InventoryTab onOpenRestock={() => setIsRestockOpen(true)} />
      )}

      {activeSection === 'finance' && (
        <ExpensesTab onOpenExpenseModal={() => setIsExpenseOpen(true)} />
      )}

      {activeSection === 'partners-suppliers' && <LedgerTab />}

      {activeSection === 'settings' && <CityRatesTab />}

      {/* Slide-over Order Details Drawer */}
      <OrderDetailsDrawer
        sale={selectedDrawerSale}
        isOpen={Boolean(selectedDrawerSale)}
        onClose={() => setSelectedDrawerSale(null)}
        onUpdateStatus={handleUpdateStatus}
        onOpenReturnModal={(sale) => setReturnModalSale(sale)}
        onDeleteSale={handleDeleteSale}
      />

      {/* Guided Step-by-Step Wizards & Modals */}
      <NewDispatchWizard
        isOpen={isNewDispatchOpen}
        onClose={() => setIsNewDispatchOpen(false)}
        onSuccess={() => {
          toast.success('Order dispatched successfully!')
          refreshAll()
        }}
      />

      <RestockWizard
        isOpen={isRestockOpen}
        onClose={() => setIsRestockOpen(false)}
        onSuccess={() => {
          toast.success('Stock restocked successfully!')
          refreshAll()
        }}
      />

      <ExpenseWizard
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

    </AppShell>
  )
}
