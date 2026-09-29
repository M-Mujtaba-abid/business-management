'use client'

import { useState, useEffect, useCallback } from 'react'
import AppShell from '@/components/ui/AppShell'
import { NavSection } from '@/components/ui/Sidebar'
import DashboardStats from '@/components/DashboardStats'
import OrderList, { Sale, OrderFilters, EMPTY_ORDER_FILTERS } from '@/components/OrderList'
import OrderDetailsDrawer from '@/components/ui/OrderDetailsDrawer'
/* OLD INVENTORY FLOW — uncomment to restore
import NewDispatchWizard from '@/components/ui/NewDispatchWizard'
import RestockWizard from '@/components/ui/RestockWizard'
import InventoryTab from '@/components/InventoryTab'
*/
import QuickOrderForm from '@/components/ui/QuickOrderForm'
import SupplierPaymentsTab from '@/components/SupplierPaymentsTab'
import ReceivablesTab from '@/components/ReceivablesTab'
import PeopleMoneyTab from '@/components/PeopleMoneyTab'
import ExpenseWizard from '@/components/ui/ExpenseWizard'
import MarkReturnedModal from '@/components/MarkReturnedModal'
import ExpensesTab from '@/components/ExpensesTab'
import CityRatesTab from '@/components/CityRatesTab'
// import LedgerTab from '@/components/LedgerTab' // PARTNERS LEDGER — uncomment to restore
import { Toaster, toast } from 'sonner'

export default function Home() {
  const [activeSection, setActiveSection] = useState<NavSection>('dashboard')
  const [dateRange, setDateRange] = useState<string>('all')
  const [startDate, setStartDate] = useState<string>('')
  const [endDate, setEndDate] = useState<string>('')
  const [statusFilter, setStatusFilter] = useState<string>('ALL')
  const [searchQuery, setSearchQuery] = useState<string>('')
  const [orderFilters, setOrderFilters] = useState<OrderFilters>(EMPTY_ORDER_FILTERS)

  // State Data
  const [sales, setSales] = useState<Sale[]>([])
  const [lowStockCount] = useState<number>(0) // OLD INVENTORY FLOW: was [lowStockCount, setLowStockCount]
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
    supplierPendingTotal: 0,
    returnedItemsCount: 0,
    orderExpenses: 0,
    receivablePendingTotal: 0,
    receivablePendingCount: 0,
  })

  // Loading States
  const [isStatsLoading, setIsStatsLoading] = useState(true)
  const [isSalesLoading, setIsSalesLoading] = useState(true)
  const [isSeeding, setIsSeeding] = useState(false)

  // Modals & Drawers
  const [isNewDispatchOpen, setIsNewDispatchOpen] = useState(false)
  const [, setIsRestockOpen] = useState(false) // OLD INVENTORY FLOW: was [isRestockOpen, setIsRestockOpen]
  const [isExpenseOpen, setIsExpenseOpen] = useState(false)
  const [selectedDrawerSale, setSelectedDrawerSale] = useState<Sale | null>(null)
  const [returnModalSale, setReturnModalSale] = useState<Sale | null>(null)

  // Fetch KPI Stats
  const fetchStats = useCallback(async () => {
    setIsStatsLoading(true)
    try {
      let url = `/api/stats?range=${dateRange}`
      if (startDate) url += `&startDate=${startDate}`
      if (endDate) url += `&endDate=${endDate}`
      const res = await fetch(url)
      if (res.ok) {
        const data = await res.json()
        setStats(data)
      }
    } catch (err) {
      console.error('Failed to fetch stats:', err)
    } finally {
      setIsStatsLoading(false)
    }
  }, [dateRange, startDate, endDate])

  // Fetch Sales List
  const fetchSales = useCallback(async () => {
    setIsSalesLoading(true)
    try {
      let url = `/api/sales?range=${dateRange}&status=${statusFilter}`
      if (startDate) url += `&startDate=${startDate}`
      if (endDate) url += `&endDate=${endDate}`
      if (searchQuery) {
        url += `&search=${encodeURIComponent(searchQuery)}`
      }
      if (orderFilters.categoryId) url += `&categoryId=${orderFilters.categoryId}`
      if (orderFilters.supplierId) url += `&supplierId=${orderFilters.supplierId}`
      if (orderFilters.supplierPayment) url += `&supplierPayment=${orderFilters.supplierPayment}`
      if (orderFilters.olderThanDays) url += `&olderThanDays=${orderFilters.olderThanDays}`
      if (orderFilters.receivedById) url += `&receivedById=${orderFilters.receivedById}`
      if (orderFilters.orderSourceId) url += `&orderSourceId=${orderFilters.orderSourceId}`
      if (orderFilters.paymentSourceId) url += `&paymentSourceId=${orderFilters.paymentSourceId}`
      if (orderFilters.paymentStatus) url += `&paymentStatus=${orderFilters.paymentStatus}`
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
  }, [dateRange, statusFilter, searchQuery, startDate, endDate, orderFilters])

  /* OLD INVENTORY FLOW — uncomment to restore (and add fetchLowStockCount back to refreshAll)
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
  */

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

  // Handle Quick Order Status Change
  const handleUpdateStatus = async (
    id: string,
    status: string,
    extra?: { returnLoss?: number; coverReturned?: boolean }
  ) => {
    try {
      const res = await fetch(`/api/sales/${id}`, {
        method: 'PATCH',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ status, ...extra }),
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

  // Mark money from Daraz / courier / other as Received / Not received
  const handleSetCustomerPayment = async (saleIds: string[], status: 'RECEIVED' | 'NOT_RECEIVED') => {
    try {
      const res = await fetch('/api/sales/customer-payment', {
        method: 'PATCH',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ saleIds, status }),
      })
      if (!res.ok) {
        const errData = await res.json()
        throw new Error(errData.error || 'Failed to update payment')
      }
      toast.success(status === 'RECEIVED' ? 'Payment marked as received' : 'Payment marked as not received')
      refreshAll()
    } catch (err: any) {
      toast.error(err.message || 'Failed to update payment')
    }
  }

  // Change whose account the order money goes to
  const handleSetReceivedBy = async (saleIds: string[], personId: string | null) => {
    try {
      const res = await fetch('/api/sales/customer-payment', {
        method: 'PATCH',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ saleIds, receivedById: personId }),
      })
      if (!res.ok) {
        const errData = await res.json()
        throw new Error(errData.error || 'Failed to update person')
      }
      toast.success('Updated who receives the money')
      refreshAll()
    } catch (err: any) {
      toast.error(err.message || 'Failed to update person')
    }
  }

  // Mark supplier payment Paid / Pending for one or many orders
  const handleSetSupplierPayment = async (saleIds: string[], status: 'PAID' | 'PENDING') => {
    try {
      const res = await fetch('/api/sales/supplier-payment', {
        method: 'PATCH',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ saleIds, status }),
      })
      if (!res.ok) {
        const errData = await res.json()
        throw new Error(errData.error || 'Failed to update supplier payment')
      }
      toast.success(status === 'PAID' ? 'Supplier payment marked Paid' : 'Supplier payment marked Pending')
      refreshAll()
    } catch (err: any) {
      toast.error(err.message || 'Failed to update supplier payment')
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
      startDate={startDate}
      setStartDate={setStartDate}
      endDate={endDate}
      setEndDate={setEndDate}
      onOpenNewDispatch={() => setIsNewDispatchOpen(true)}
      onOpenRestock={() => setIsRestockOpen(true)}
      onOpenExpense={() => setIsExpenseOpen(true)}
      onSeedData={handleSeedData}
      isSeeding={isSeeding}
    >
      <Toaster position="top-right" theme="light" richColors />

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
          onViewSupplierPayments={() => setActiveSection('partners-suppliers')}
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
          startDate={startDate}
          setStartDate={setStartDate}
          endDate={endDate}
          setEndDate={setEndDate}
          setDateRange={setDateRange}
          filters={orderFilters}
          setFilters={setOrderFilters}
          onSetSupplierPayment={handleSetSupplierPayment}
          onSetCustomerPayment={handleSetCustomerPayment}
          onSelectOrder={(sale) => setSelectedDrawerSale(sale)}
        />
      )}

      {/* OLD INVENTORY FLOW — uncomment to restore
      {activeSection === 'inventory' && (
        <InventoryTab onOpenRestock={() => setIsRestockOpen(true)} />
      )}
      */}

      {activeSection === 'finance' && (
        <ExpensesTab onOpenExpenseModal={() => setIsExpenseOpen(true)} />
      )}

      {activeSection === 'partners-suppliers' && (
        <div className="space-y-6">
          <PeopleMoneyTab
            onViewOrders={(receivedById) => {
              setOrderFilters({ ...EMPTY_ORDER_FILTERS, receivedById })
              setStatusFilter('ALL')
              setActiveSection('orders')
            }}
          />
          <ReceivablesTab
            onChanged={refreshAll}
            onViewOrders={(paymentSourceId) => {
              setOrderFilters({ ...EMPTY_ORDER_FILTERS, paymentSourceId, paymentStatus: 'NOT_RECEIVED' })
              setStatusFilter('DELIVERED')
              setActiveSection('orders')
            }}
          />
          <SupplierPaymentsTab
            onChanged={refreshAll}
            onViewOrders={(supplierId) => {
              setOrderFilters({ ...EMPTY_ORDER_FILTERS, supplierId, supplierPayment: 'PENDING' })
              setStatusFilter('ALL')
              setActiveSection('orders')
            }}
          />
          {/* PARTNERS LEDGER — uncomment to restore
          <LedgerTab />
          */}
        </div>
      )}

      {activeSection === 'settings' && <CityRatesTab />}

      {/* Slide-over Order Details Drawer */}
      <OrderDetailsDrawer
        sale={selectedDrawerSale}
        isOpen={Boolean(selectedDrawerSale)}
        onClose={() => setSelectedDrawerSale(null)}
        onUpdateStatus={handleUpdateStatus}
        onOpenReturnModal={(sale) => setReturnModalSale(sale)}
        onDeleteSale={handleDeleteSale}
        onSetSupplierPayment={handleSetSupplierPayment}
        onSetCustomerPayment={handleSetCustomerPayment}
        onSetReceivedBy={handleSetReceivedBy}
      />

      {/* Guided Step-by-Step Wizards & Modals */}
      <QuickOrderForm
        isOpen={isNewDispatchOpen}
        onClose={() => setIsNewDispatchOpen(false)}
        onSuccess={() => {
          toast.success('Order saved!')
          refreshAll()
        }}
      />

      {/* OLD INVENTORY FLOW — uncomment to restore
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
      */}

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
        onConfirm={(saleId, returnLoss, coverReturned) => {
          handleUpdateStatus(saleId, 'RETURNED', { returnLoss, coverReturned })
          setReturnModalSale(null)
        }}
      />

    </AppShell>
  )
}
