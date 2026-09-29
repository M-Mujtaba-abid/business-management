import { NextRequest, NextResponse } from 'next/server'
import prisma from '@/lib/prisma'

export const dynamic = 'force-dynamic'

export async function GET(request: NextRequest) {
  try {
    const { searchParams } = new URL(request.url)
    const startDate = searchParams.get('startDate')
    const endDate = searchParams.get('endDate')
    const range = searchParams.get('range') || 'all'

    let dateFilter: any = {}
    const now = new Date()

    if (startDate || endDate) {
      if (startDate) {
        const [sY, sM, sD] = startDate.split('-').map(Number)
        dateFilter.gte = new Date(sY, sM - 1, sD, 0, 0, 0, 0)
      }
      if (endDate) {
        const [eY, eM, eD] = endDate.split('-').map(Number)
        dateFilter.lte = new Date(eY, eM - 1, eD, 23, 59, 59, 999)
      }
    } else if (range === 'today') {
      const startOfDay = new Date(now.getFullYear(), now.getMonth(), now.getDate(), 0, 0, 0, 0)
      const endOfDay = new Date(now.getFullYear(), now.getMonth(), now.getDate(), 23, 59, 59, 999)
      dateFilter = { gte: startOfDay, lte: endOfDay }
    } else if (range === 'week') {
      const startOfWeek = new Date(now)
      startOfWeek.setDate(now.getDate() - now.getDay())
      startOfWeek.setHours(0, 0, 0, 0)
      dateFilter = { gte: startOfWeek }
    } else if (range === 'month') {
      const startOfMonth = new Date(now.getFullYear(), now.getMonth(), 1, 0, 0, 0, 0)
      dateFilter = { gte: startOfMonth }
    } else if (/^\d{4}-\d{2}$/.test(range)) {
      // Format: YYYY-MM (e.g. 2026-07)
      const [yearStr, monthStr] = range.split('-')
      const year = parseInt(yearStr, 10)
      const month = parseInt(monthStr, 10) - 1
      const startOfMonth = new Date(year, month, 1, 0, 0, 0, 0)
      const endOfMonth = new Date(year, month + 1, 0, 23, 59, 59, 999)
      dateFilter = { gte: startOfMonth, lte: endOfMonth }
    } else if (/^\d{4}$/.test(range)) {
      // Format: YYYY (e.g. 2026)
      const year = parseInt(range, 10)
      const startOfYear = new Date(year, 0, 1, 0, 0, 0, 0)
      const endOfYear = new Date(year, 11, 31, 23, 59, 59, 999)
      dateFilter = { gte: startOfYear, lte: endOfYear }
    }

    const salesWhere = (dateFilter.gte || dateFilter.lte) ? { createdAt: dateFilter } : {}
    const expensesWhere = (dateFilter.gte || dateFilter.lte) ? { createdAt: dateFilter } : {}

    // Fetch Sales
    const sales = await prisma.sale.findMany({
      where: salesWhere,
    })

    // Delivered Sales
    const deliveredSales = sales.filter((s) => s.status === 'DELIVERED')
    const totalRevenue = deliveredSales.reduce((acc, s) => acc + s.soldPrice * s.quantity, 0)
    const grossProfit = deliveredSales.reduce((acc, s) => acc + s.profit, 0)

    // Order-level costs on delivered sales (already subtracted inside each sale's profit)
    const orderExpenses = deliveredSales.reduce(
      (acc, s) => acc + s.deliveryCharge + s.petrolCost + s.gstAmount,
      0
    )

    // Returned Sales: a returned order's profit is stored as -(loss), for old and new orders alike
    const returnLoss = sales
      .filter((s) => s.status === 'RETURNED' && s.profit < 0)
      .reduce((acc, s) => acc + -s.profit, 0)

    // Active Dispatches
    const activeDispatches = sales.filter((s) => s.status === 'DISPATCHED').length
    const totalOrdersCount = sales.length

    // General Expenses
    const expenses = await prisma.expense.findMany({
      where: expensesWhere,
    })
    const generalExpenses = expenses.reduce((acc, e) => acc + e.amount, 0)

    // True Net Profit
    const trueNetProfit = grossProfit - returnLoss - generalExpenses

    // Total Expenses = General Expenses + Return Loss
    const totalExpensesCombined = generalExpenses + returnLoss

    // Partners & Supplier Ledger
    const partners = await prisma.partner.findMany({
      orderBy: { name: 'asc' },
    })

    const suppliers = await prisma.supplier.findMany({
      orderBy: { name: 'asc' },
    })
    const totalSupplierDebt = suppliers.reduce((acc, sup) => acc + sup.unpaidBalance, 0)

    // Market supplier payables (all time, not date filtered: debt is owed regardless of period)
    const pendingSupplierSales = await prisma.sale.findMany({
      where: { supplierPaymentStatus: 'PENDING' },
      select: { costPrice: true, quantity: true },
    })
    const supplierPendingTotal = pendingSupplierSales.reduce((acc, s) => acc + s.costPrice * s.quantity, 0)

    const returnedItemsCount = await prisma.returnedItem.count({ where: { status: 'AVAILABLE' } })

    // Money still to come in from Daraz / courier / others for delivered orders (all time)
    const unpaidDelivered = await prisma.sale.findMany({
      where: { paymentStatus: 'NOT_RECEIVED', status: 'DELIVERED' },
      select: { soldPrice: true, quantity: true },
    })
    const receivablePendingTotal = unpaidDelivered.reduce((acc, s) => acc + s.soldPrice * s.quantity, 0)
    const receivablePendingCount = unpaidDelivered.length

    return NextResponse.json({
      orderExpenses,
      supplierPendingTotal,
      returnedItemsCount,
      receivablePendingTotal,
      receivablePendingCount,
      totalRevenue,
      grossProfit,
      returnLoss,
      generalExpenses,
      trueNetProfit,
      totalExpensesCombined,
      activeDispatches,
      totalOrdersCount,
      partners,
      suppliers,
      totalSupplierDebt,
    })
  } catch (error: any) {
    console.error('Stats error:', error)
    return NextResponse.json({ error: error.message || 'Failed to fetch stats' }, { status: 500 })
  }
}
