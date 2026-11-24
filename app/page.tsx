'use client'

import { useState, useEffect, useCallback, useMemo, useRef, MutableRefObject } from 'react'
import AppShell from '@/components/ui/AppShell'
import { NavSection, NAV_SECTIONS } from '@/components/ui/Sidebar'
import DashboardStats from '@/components/DashboardStats'
import OrderList, { Sale, OrderFilters, EMPTY_ORDER_FILTERS } from '@/components/OrderList'
import OrderDetailsDrawer from '@/components/ui/OrderDetailsDrawer'
/* OLD INVENTORY FLOW — uncomment to restore
import NewDispatchWizard from '@/components/ui/NewDispatchWizard'
import RestockWizard from '@/components/ui/RestockWizard'
import InventoryTab from '@/components/InventoryTab'
*/
import QuickOrderForm from '@/components/ui/QuickOrderForm'
import InventoryPage from '@/components/InventoryPage'
import InventoryMoneyTab from '@/components/InventoryMoneyTab'
import CapitalTab from '@/components/CapitalTab'
import SupplierPaymentsTab from '@/components/SupplierPaymentsTab'
import ReceivablesTab from '@/components/ReceivablesTab'
import LeopardsPaymentsTab from '@/components/LeopardsPaymentsTab'
import PeopleMoneyTab from '@/components/PeopleMoneyTab'
import ExpenseWizard from '@/components/ui/ExpenseWizard'
import MarkReturnedModal from '@/components/MarkReturnedModal'
import ReceivePaymentModal from '@/components/ReceivePaymentModal'
import ExpensesTab from '@/components/ExpensesTab'
import CityRatesTab from '@/components/CityRatesTab'
import WhatsAppPage from '@/components/WhatsAppPage'
import WhatsAppSwitches from '@/components/WhatsAppSwitches'
import UsersSettings from '@/components/UsersSettings'
import LogsPage from '@/components/LogsPage'
import NeedsAttention from '@/components/NeedsAttention'
import DailyReportSettings from '@/components/DailyReportSettings'
// import LedgerTab from '@/components/LedgerTab' // PARTNERS LEDGER — uncomment to restore
import { Toaster, toast } from 'sonner'

export default function Home() {
  // The open page lives in the URL (?tab=orders), so a reload or the Back button keeps you on it
  const [activeSection, setActiveSectionState] = useState<NavSection>('dashboard')
  const [sectionReady, setSectionReady] = useState(false)
  useEffect(() => {
    const fromUrl = () => {
      const tab = new URLSearchParams(window.location.search).get('tab')
      setActiveSectionState(tab && (NAV_SECTIONS as readonly string[]).includes(tab) ? (tab as NavSection) : 'dashboard')
    }
    fromUrl()
    setSectionReady(true)
    window.addEventListener('popstate', fromUrl)
    return () => window.removeEventListener('popstate', fromUrl)
  }, [])
  const setActiveSection = useCallback((section: NavSection) => {
    setActiveSectionState(section)
    const url = new URL(window.location.href)
    if (section === 'dashboard') url.searchParams.delete('tab')
    else url.searchParams.set('tab', section)
    if (url.href !== window.location.href) window.history.pushState(null, '', url)
  }, [])
  const [dateRange, setDateRange] = useState<string>('all')
  const [startDate, setStartDate] = useState<string>('')
  const [endDate, setEndDate] = useState<string>('')
  const [statusFilter, setStatusFilter] = useState<string>('ALL')
  const [searchQuery, setSearchQuery] = useState<string>('')
  const [orderFilters, setOrderFilters] = useState<OrderFilters>(EMPTY_ORDER_FILTERS)

  // State Data
  const [sales, setSales] = useState<Sale[]>([])
  // Orders per status tab for the current filters, e.g. { ALL: 120, PACKING: 8, … }
  const [statusCounts, setStatusCounts] = useState<Record<string, number> | null>(null)
  const [lowStockCount] = useState<number>(0) // OLD INVENTORY FLOW: was [lowStockCount, setLowStockCount]
  const [stats, setStats] = useState({
    totalRevenue: 0,
    grossProfit: 0,
    returnLoss: 0,
    generalExpenses: 0,
    trueNetProfit: 0,
    totalExpensesCombined: 0,
    activeDispatches: 0,
    packingCount: 0,
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
  // The open order lives in OrderDrawerHost: opening it then re-renders only the drawer, not the whole
  // page (re-rendering every order row made the drawer slow to open, so a 2nd click closed it again)
  const drawerRef = useRef<((sale: Sale | null) => void) | null>(null)
  const setSelectedDrawerSale = useCallback((sale: Sale | null) => drawerRef.current?.(sale), [])
  const [returnModalSale, setReturnModalSale] = useState<Sale | null>(null)
  const [receiveModal, setReceiveModal] = useState<{ sale: Sale; mode: 'receive' | 'edit' } | null>(null)
  // Products of the order being edited (null = form is for a new order)
  const [editOrderItems, setEditOrderItems] = useState<Sale[] | null>(null)

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
      if (orderFilters.missingRef) url += `&missingRef=1`
      if (orderFilters.receivedById) url += `&receivedById=${orderFilters.receivedById}`
      if (orderFilters.orderSourceId) url += `&orderSourceId=${orderFilters.orderSourceId}`
      if (orderFilters.paymentSourceId) url += `&paymentSourceId=${orderFilters.paymentSourceId}`
      if (orderFilters.paymentStatus) url += `&paymentStatus=${orderFilters.paymentStatus}`
      if (orderFilters.customerResponse) url += `&customerResponse=${orderFilters.customerResponse}`
      if (orderFilters.returnState) url += `&returnState=${orderFilters.returnState}`
      if (orderFilters.reviewStatus) url += `&reviewStatus=${orderFilters.reviewStatus}`
      if (orderFilters.attention) url += `&attention=${orderFilters.attention}`
      // The numbers on the status tabs come with the same filters (all but the status itself)
      const [res, countsRes] = await Promise.all([
        fetch(url),
        fetch(url.replace('/api/sales?', '/api/sales/counts?')).catch(() => null),
      ])
      if (res.ok) {
        const data = await res.json()
        setSales(data)
      }
      setStatusCounts(countsRes?.ok ? await countsRes.json() : null)
    } catch (err) {
      console.error('Failed to fetch sales:', err)
    } finally {
      setIsSalesLoading(false)
    }
  }, [dateRange, statusFilter, searchQuery, startDate, endDate, orderFilters])

  // Live WhatsApp state: while a message is on its way (every 5s) or a customer's reply is awaited
  // (every 30s), refresh only those orders' WhatsApp info in the background, without reloading the list.
  const [waTick, setWaTick] = useState(0)
  useEffect(() => {
    const now = Date.now()
    const sending: number[] = []
    const awaiting: number[] = []
    for (const s of sales) {
      if (s.orderNo == null) continue
      const onItsWay = s.whatsapp?.some(
        (m) => m.status === 'PENDING' && !(m.scheduledFor && new Date(m.scheduledFor).getTime() > now + 60_000),
      )
      if (onItsWay) sending.push(s.orderNo)
      else if (s.customerResponse === 'PENDING') awaiting.push(s.orderNo)
    }
    const orderNos = Array.from(new Set([...sending, ...awaiting])).slice(0, 200)
    if (!orderNos.length) return

    let cancelled = false
    const timer = setTimeout(async () => {
      try {
        if (document.hidden) return // tab in the background: check again later
        const res = await fetch(`/api/whatsapp/order-status?orderNos=${orderNos.join(',')}`, { cache: 'no-store' })
        if (!res.ok || cancelled) return
        const { orders } = await res.json()
        setSales((prev) => {
          let changed = false
          const next = prev.map((s) => {
            const o = s.orderNo != null ? orders[s.orderNo] : null
            if (!o) return s
            if (JSON.stringify(o.whatsapp) === JSON.stringify(s.whatsapp ?? []) && o.customerResponse === s.customerResponse) return s
            changed = true
            return { ...s, whatsapp: o.whatsapp, customerResponse: o.customerResponse, customerRespondedAt: o.customerRespondedAt }
          })
          return changed ? next : prev
        })
      } catch {
        // offline for a moment: the next round tries again
      } finally {
        if (!cancelled) setWaTick((t) => t + 1)
      }
    }, sending.length ? 5000 : 30000)
    return () => {
      cancelled = true
      clearTimeout(timer)
    }
  }, [sales, waTick])

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

  // Refresh button in the header: reloads only the open page's data (no full page reload).
  // Pages that load their own data (expenses, payments, WhatsApp, settings) are re-mounted via refreshKey.
  const [refreshKey, setRefreshKey] = useState(0)
  const [isRefreshing, setIsRefreshing] = useState(false)
  const handleRefresh = useCallback(async () => {
    setIsRefreshing(true)
    setRefreshKey((k) => k + 1)
    try {
      await Promise.all([fetchStats(), fetchSales()])
    } finally {
      setIsRefreshing(false)
    }
  }, [fetchStats, fetchSales])

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

  // Save the actual amount received for one order (and mark it Received when receiving)
  const handleReceivePayment = async (saleId: string, receivedAmount: number, markReceived: boolean) => {
    try {
      const res = await fetch(`/api/sales/${saleId}/payment`, {
        method: 'PATCH',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(markReceived ? { receivedAmount, status: 'RECEIVED' } : { receivedAmount }),
      })
      if (!res.ok) {
        const errData = await res.json()
        throw new Error(errData.error || 'Failed to save payment')
      }
      toast.success(markReceived ? 'Payment marked as received' : 'Received amount updated')
      setSelectedDrawerSale(null)
      refreshAll()
    } catch (err: any) {
      toast.error(err.message || 'Failed to save payment')
      throw err
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

      if (!res.ok) throw new Error((await res.json().catch(() => ({}))).error || 'Failed to delete order')

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
      onRefresh={handleRefresh}
      isRefreshing={isRefreshing}
    >
      <Toaster position="top-right" theme="light" richColors />

      {/* Render Active View */}
      {sectionReady && activeSection === 'dashboard' && (
        <div className="mb-6">
          <NeedsAttention
            refreshKey={refreshKey}
            onOpen={(open) => {
              if (open.section === 'orders' && open.attention) {
                setOrderFilters({ ...EMPTY_ORDER_FILTERS, attention: open.attention })
                setStatusFilter('ALL')
                setActiveSection('orders')
              } else {
                setActiveSection(open.section as NavSection)
              }
            }}
          />
        </div>
      )}
      {sectionReady && activeSection === 'dashboard' && (
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
          onViewOrders={(status) => {
            setStatusFilter(status)
            setActiveSection('orders')
          }}
          onViewSupplierPayments={() => setActiveSection('partners-suppliers')}
        />
      )}

      {sectionReady && activeSection === 'orders' && (
        <OrderList
          sales={sales}
          statusCounts={statusCounts}
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
          onReceivePayment={(sale) => setReceiveModal({ sale, mode: 'receive' })}
          onEditOrder={(items) => setEditOrderItems(items)}
          onSelectOrder={(sale) => setSelectedDrawerSale(sale)}
          onChanged={fetchSales}
        />
      )}

      {/* Inventory: our own stock (replaces the old InventoryTab / Product flow) */}
      {sectionReady && activeSection === 'inventory' && <InventoryPage key={refreshKey} />}

      {sectionReady && activeSection === 'finance' && (
        <ExpensesTab key={refreshKey} onOpenExpenseModal={() => setIsExpenseOpen(true)} />
      )}

      {sectionReady && activeSection === 'partners-suppliers' && (
        <div key={refreshKey} className="space-y-6">
          <PeopleMoneyTab
            onChanged={refreshAll}
            onOpenOrder={async (orderNo) => {
              // show this order in the Orders list and open its side drawer
              setOrderFilters({ ...EMPTY_ORDER_FILTERS })
              setStatusFilter('ALL')
              setDateRange('all')
              setSearchQuery(String(orderNo))
              setActiveSection('orders')
              try {
                const r = await fetch(`/api/sales?range=all&status=ALL&search=${orderNo}`)
                const rows: Sale[] = r.ok ? await r.json() : []
                const sale = rows.find((s) => s.orderNo === orderNo)
                if (sale) setSelectedDrawerSale(sale)
              } catch {}
            }}
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
          <LeopardsPaymentsTab onChanged={refreshAll} />
          <SupplierPaymentsTab
            onChanged={refreshAll}
            onViewOrders={(supplierId) => {
              setOrderFilters({ ...EMPTY_ORDER_FILTERS, supplierId, supplierPayment: 'PENDING' })
              setStatusFilter('ALL')
              setActiveSection('orders')
            }}
          />
          <InventoryMoneyTab onOpenInventory={() => setActiveSection('inventory')} />
          <CapitalTab refreshKey={refreshKey} />
          {/* PARTNERS LEDGER — uncomment to restore
          <LedgerTab />
          */}
        </div>
      )}

      {sectionReady && activeSection === 'whatsapp' && <WhatsAppPage key={refreshKey} />}

      {sectionReady && activeSection === 'logs' && <LogsPage key={refreshKey} />}

      {sectionReady && activeSection === 'settings' && (
        <div key={refreshKey} className="space-y-6">
          <UsersSettings />
          <DailyReportSettings />
          <WhatsAppSwitches />
          <CityRatesTab />
        </div>
      )}

      {/* Slide-over Order Details Drawer */}
      <OrderDrawerHost
        register={drawerRef}
        sales={sales}
        onDeleteSale={handleDeleteSale}
        onEditOrder={(items) => setEditOrderItems(items)}
        onSaved={refreshAll}
      />

      <ReceivePaymentModal
        sale={receiveModal?.sale ?? null}
        mode={receiveModal?.mode ?? 'receive'}
        onClose={() => setReceiveModal(null)}
        onConfirm={handleReceivePayment}
      />

      {/* Guided Step-by-Step Wizards & Modals */}
      <QuickOrderForm
        isOpen={isNewDispatchOpen || Boolean(editOrderItems)}
        editItems={editOrderItems}
        onClose={() => {
          setIsNewDispatchOpen(false)
          setEditOrderItems(null)
        }}
        onSuccess={() => {
          toast.success(editOrderItems ? 'Changes saved!' : 'Order saved!')
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

// Holds which order is open in the drawer (see drawerRef in Home)
function OrderDrawerHost({
  register,
  sales,
  onDeleteSale,
  onEditOrder,
  onSaved,
}: {
  register: MutableRefObject<((sale: Sale | null) => void) | null>
  sales: Sale[]
  onDeleteSale: (id: string) => void
  onEditOrder: (items: Sale[]) => void
  onSaved: () => void
}) {
  const [selected, setSelected] = useState<Sale | null>(null)
  register.current = setSelected
  // The open order's products, read from the latest list so the drawer never shows stale data
  const items = useMemo(() => {
    if (!selected) return []
    const parcelId = selected.parcelId
    const fresh = parcelId ? sales.filter((s) => s.parcelId === parcelId) : sales.filter((s) => s.id === selected.id)
    return fresh.length ? fresh : [selected]
  }, [selected, sales])
  return (
    <OrderDetailsDrawer
      items={items}
      isOpen={Boolean(selected)}
      onClose={() => setSelected(null)}
      onDeleteSale={onDeleteSale}
      onEditOrder={onEditOrder}
      onSaved={onSaved}
    />
  )
}
