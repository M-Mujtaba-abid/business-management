import { NextRequest, NextResponse } from 'next/server'
import prisma from '@/lib/prisma'
import { parseDateRange, hasBounds } from '@/lib/dateRange'
import { payoutAmount, paymentFee, countOrders } from '@/lib/saleMoney'

export const dynamic = 'force-dynamic'

const DAY = 86400000
const OVERDUE_DAYS = 15

const EXPENSE_LABELS: Record<string, string> = {
  MARKETING_ADS: 'Ads',
  PACKAGING: 'Packaging',
  COURIER_BILL: 'Courier bills',
  LOGISTICS: 'Logistics',
  UTILITIES: 'Utilities',
  MISC: 'Misc',
}

const startOfDay = (d: Date) => new Date(d.getFullYear(), d.getMonth(), d.getDate())
const dayKey = (d: Date) => `${d.getFullYear()}-${d.getMonth() + 1}-${d.getDate()}`
const monthKey = (d: Date) => `${d.getFullYear()}-${d.getMonth() + 1}`

export async function GET(request: NextRequest) {
  try {
    const { searchParams } = new URL(request.url)
    const dateFilter = parseDateRange(searchParams)
    const inPeriod = hasBounds(dateFilter) ? { createdAt: dateFilter } : {}
    const now = new Date()

    // Trend window: the selected period, or the last 30 days when the period is open-ended or shorter than a week
    let trendStart = dateFilter.gte ? startOfDay(dateFilter.gte) : startOfDay(new Date(now.getTime() - 29 * DAY))
    const trendEnd = dateFilter.lte && dateFilter.lte < now ? dateFilter.lte : now
    if (trendEnd.getTime() - trendStart.getTime() < 6 * DAY) {
      trendStart = startOfDay(new Date(trendEnd.getTime() - 29 * DAY))
    }
    const byMonth = trendEnd.getTime() - trendStart.getTime() > 62 * DAY

    // Previous period of the same length (for the Sales % change); only for bounded periods
    const periodStart = dateFilter.gte
    const periodEnd = dateFilter.lte && dateFilter.lte < now ? dateFilter.lte : now
    const prevWindow = periodStart
      ? { gte: new Date(periodStart.getTime() - (periodEnd.getTime() - periodStart.getTime())), lt: periodStart }
      : null

    // All queries in parallel, selecting only the columns we use
    const [
      sales,
      expenses,
      trendSales,
      trendExpenses,
      prevDelivered,
      pendingSupplierSales,
      unpaidDelivered,
      returnedItemsCount,
      partners,
      suppliers,
    ] = await Promise.all([
      prisma.sale.findMany({
        where: inPeriod,
        select: {
          id: true, parcelId: true,
          status: true, soldPrice: true, quantity: true, profit: true, receivedAmount: true,
          deliveryCharge: true, petrolCost: true, gstAmount: true,
        },
      }),
      prisma.expense.groupBy({ by: ['category'], where: inPeriod, _sum: { amount: true } }),
      prisma.sale.findMany({
        where: { createdAt: { gte: trendStart, lte: trendEnd } },
        select: { id: true, parcelId: true, createdAt: true, status: true, soldPrice: true, quantity: true, profit: true },
      }),
      prisma.expense.findMany({
        where: { createdAt: { gte: trendStart, lte: trendEnd } },
        select: { createdAt: true, amount: true },
      }),
      prevWindow
        ? prisma.sale.findMany({
            where: { status: 'DELIVERED', createdAt: prevWindow },
            select: { soldPrice: true, quantity: true },
          })
        : Promise.resolve(null),
      // Supplier payables and receivables are all time: money is owed regardless of the period
      prisma.sale.findMany({
        where: { supplierPaymentStatus: 'PENDING' },
        select: { costPrice: true, quantity: true, createdAt: true },
      }),
      prisma.sale.findMany({
        where: { paymentStatus: 'NOT_RECEIVED', status: 'DELIVERED' },
        select: { id: true, parcelId: true, soldPrice: true, quantity: true, receivedAmount: true },
      }),
      prisma.returnedItem.count({ where: { status: 'AVAILABLE' } }),
      prisma.partner.findMany({ orderBy: { name: 'asc' } }),
      prisma.supplier.findMany({ orderBy: { name: 'asc' }, select: { unpaidBalance: true } }),
    ])

    // Period totals
    const delivered = sales.filter((s) => s.status === 'DELIVERED')
    const totalRevenue = delivered.reduce((acc, s) => acc + s.soldPrice * s.quantity, 0)
    const grossProfit = delivered.reduce((acc, s) => acc + s.profit, 0)
    const dcTotal = delivered.reduce((acc, s) => acc + s.deliveryCharge, 0)
    const petrolTotal = delivered.reduce((acc, s) => acc + s.petrolCost, 0)
    const gstTotal = delivered.reduce((acc, s) => acc + s.gstAmount, 0)
    const orderExpenses = dcTotal + petrolTotal + gstTotal
    // Tax / fee cut by Daraz, couriers, etc. (sale total minus the received amount); already inside each sale's profit
    const paymentFees = delivered.reduce((acc, s) => acc + paymentFee(s), 0)
    // A returned order's profit is stored as -(loss), for old and new orders alike
    const returnLoss = sales.filter((s) => s.status === 'RETURNED' && s.profit < 0).reduce((acc, s) => acc - s.profit, 0)
    const activeDispatches = countOrders(sales.filter((s) => s.status === 'DISPATCHED'))
    const packingCount = countOrders(sales.filter((s) => s.status === 'PACKING'))
    const generalExpenses = expenses.reduce((acc, e) => acc + (e._sum.amount || 0), 0)
    const trueNetProfit = grossProfit - returnLoss - generalExpenses

    // Where the money went: order-level costs + general expense categories
    const expenseBreakdown = [
      { label: 'DC', amount: dcTotal },
      { label: 'Petrol', amount: petrolTotal },
      { label: 'GST', amount: gstTotal },
      ...expenses.map((e) => ({ label: EXPENSE_LABELS[e.category] || e.category, amount: e._sum.amount || 0 })),
    ]
      .filter((x) => x.amount > 0)
      .sort((a, b) => b.amount - a.amount)

    // Trend buckets (daily, or monthly for long periods)
    const buckets: { key: string; date: string; sales: number; orderProfit: number; expenses: number; returnLoss: number; orders: number }[] = []
    const index = new Map<string, number>()
    const cursor = startOfDay(trendStart)
    if (byMonth) cursor.setDate(1)
    while (cursor <= trendEnd) {
      const key = byMonth ? monthKey(cursor) : dayKey(cursor)
      index.set(key, buckets.length)
      buckets.push({ key, date: cursor.toISOString(), sales: 0, orderProfit: 0, expenses: 0, returnLoss: 0, orders: 0 })
      if (byMonth) cursor.setMonth(cursor.getMonth() + 1)
      else cursor.setDate(cursor.getDate() + 1)
    }
    const bucketOf = (d: Date) => index.get(byMonth ? monthKey(d) : dayKey(d))
    const seenParcels = new Set<string>()
    for (const s of trendSales) {
      const i = bucketOf(s.createdAt)
      if (i === undefined) continue
      // a parcel counts as one order (only its first product adds to the count)
      if (!s.parcelId || !seenParcels.has(s.parcelId)) buckets[i].orders += 1
      if (s.parcelId) seenParcels.add(s.parcelId)
      if (s.status === 'DELIVERED') {
        buckets[i].sales += s.soldPrice * s.quantity
        buckets[i].orderProfit += s.profit
      } else if (s.status === 'RETURNED' && s.profit < 0) {
        buckets[i].returnLoss -= s.profit
      }
    }
    for (const e of trendExpenses) {
      const i = bucketOf(e.createdAt)
      if (i !== undefined) buckets[i].expenses += e.amount
    }
    const trend = buckets.map(({ key, ...b }) => ({ ...b, netProfit: b.orderProfit - b.expenses - b.returnLoss }))

    const prevRevenue = prevDelivered ? prevDelivered.reduce((acc, s) => acc + s.soldPrice * s.quantity, 0) : null
    const salesChangePct = prevRevenue && prevRevenue > 0 ? ((totalRevenue - prevRevenue) / prevRevenue) * 100 : null

    const supplierPendingTotal = pendingSupplierSales.reduce((acc, s) => acc + s.costPrice * s.quantity, 0)
    const overdueCutoff = now.getTime() - OVERDUE_DAYS * DAY
    const supplierOverdue = pendingSupplierSales.some((s) => s.createdAt.getTime() < overdueCutoff)

    return NextResponse.json({
      totalRevenue,
      grossProfit,
      orderExpenses,
      paymentFees,
      returnLoss,
      generalExpenses,
      trueNetProfit,
      totalExpensesCombined: generalExpenses + returnLoss,
      activeDispatches,
      packingCount,
      totalOrdersCount: countOrders(sales),
      expenseBreakdown,
      trend,
      trendGranularity: byMonth ? 'month' : 'day',
      salesChangePct,
      supplierPendingTotal,
      supplierOverdue,
      receivablePendingTotal: unpaidDelivered.reduce((acc, s) => acc + payoutAmount(s), 0),
      receivablePendingCount: countOrders(unpaidDelivered),
      returnedItemsCount,
      partners,
      totalSupplierDebt: suppliers.reduce((acc, sup) => acc + sup.unpaidBalance, 0),
    })
  } catch (error: any) {
    console.error('Stats error:', error)
    return NextResponse.json({ error: error.message || 'Failed to fetch stats' }, { status: 500 })
  }
}
