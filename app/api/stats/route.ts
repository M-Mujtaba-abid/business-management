import { NextRequest, NextResponse } from 'next/server'
import prisma from '@/lib/prisma'

export const dynamic = 'force-dynamic'

export async function GET(request: NextRequest) {
  try {
    const { searchParams } = new URL(request.url)
    const range = searchParams.get('range') || 'all'

    let dateFilter: any = {}
    const now = new Date()

    if (range === 'today') {
      const startOfDay = new Date(now.getFullYear(), now.getMonth(), now.getDate())
      dateFilter = { gte: startOfDay }
    } else if (range === 'week') {
      const startOfWeek = new Date(now)
      startOfWeek.setDate(now.getDate() - now.getDay())
      startOfWeek.setHours(0, 0, 0, 0)
      dateFilter = { gte: startOfWeek }
    } else if (range === 'month') {
      const startOfMonth = new Date(now.getFullYear(), now.getMonth(), 1)
      dateFilter = { gte: startOfMonth }
    }

    const salesWhere = dateFilter.gte ? { createdAt: dateFilter } : {}
    const expensesWhere = dateFilter.gte ? { createdAt: dateFilter } : {}

    // Fetch Sales
    const sales = await prisma.sale.findMany({
      where: salesWhere,
    })

    // Delivered Sales
    const deliveredSales = sales.filter((s) => s.status === 'DELIVERED')
    const totalRevenue = deliveredSales.reduce((acc, s) => acc + s.soldPrice * s.quantity, 0)
    const grossProfit = deliveredSales.reduce((acc, s) => acc + s.profit, 0)

    // Returned Sales with loss absorbed
    const returnedLossSales = sales.filter((s) => s.status === 'RETURNED' && s.deductDeliveryOnReturn)
    const returnLoss = returnedLossSales.reduce((acc, s) => acc + s.deliveryCharge, 0)

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

    return NextResponse.json({
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
