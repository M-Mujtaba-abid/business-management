import type { Prisma } from '@prisma/client'
import { OrderStatus, SupplierPayment, CustomerPayment, CustomerResponse } from '@prisma/client'

// The orders list filters (status tab, date range, search, filter panel) as a Prisma where.
// Shared by GET /api/sales (the list) and GET /api/sales/counts (the numbers on the status tabs,
// which use every filter except the status itself).
export function salesWhere(searchParams: URLSearchParams, opts: { ignoreStatus?: boolean } = {}): Prisma.SaleWhereInput {
  const search = searchParams.get('search') || ''
  const status = opts.ignoreStatus ? 'ALL' : searchParams.get('status') || 'ALL'
  const range = searchParams.get('range') || 'all'

  const where: any = {}

  if (status !== 'ALL') {
    where.status = status as OrderStatus
  }

  const categoryId = searchParams.get('categoryId')
  const supplierId = searchParams.get('supplierId')
  const supplierPayment = searchParams.get('supplierPayment')
  const olderThanDays = parseInt(searchParams.get('olderThanDays') || '', 10)
  const paymentSourceId = searchParams.get('paymentSourceId')
  const paymentStatus = searchParams.get('paymentStatus')
  const orderSourceId = searchParams.get('orderSourceId')
  const receivedById = searchParams.get('receivedById')

  if (categoryId) where.categoryId = categoryId
  if (supplierId) where.supplierId = supplierId
  if (supplierPayment === 'PENDING' || supplierPayment === 'PAID') {
    where.supplierPaymentStatus = supplierPayment as SupplierPayment
  }
  if (receivedById === 'none') where.receivedById = null
  else if (receivedById) where.receivedById = receivedById
  if (orderSourceId === 'none') where.orderSourceId = null
  else if (orderSourceId) where.orderSourceId = orderSourceId
  if (paymentSourceId === 'none') where.paymentSourceId = null
  else if (paymentSourceId) where.paymentSourceId = paymentSourceId
  if (paymentStatus === 'NOT_RECEIVED' || paymentStatus === 'RECEIVED') {
    where.paymentStatus = paymentStatus as CustomerPayment
  }
  // Customer's WhatsApp reply (e.g. orders the customer cancelled)
  const customerResponse = searchParams.get('customerResponse')
  if (customerResponse === 'PENDING' || customerResponse === 'CONFIRMED' || customerResponse === 'CANCELLED') {
    where.customerResponse = customerResponse as CustomerResponse
  }
  // Returned orders whose parcel has not come back yet (PENDING) / has come back (RECEIVED)
  const returnState = searchParams.get('returnState')
  if (returnState === 'PENDING' || returnState === 'RECEIVED') {
    where.status = 'RETURNED'
    where.returnReceived = returnState === 'RECEIVED'
  }
  // Orders with neither a Daraz / Website order ID nor a tracking number yet
  if (searchParams.get('missingRef') === '1') {
    where.externalOrderId = null
    where.trackingNumber = null
  }

  if (search) {
    where.OR = [
      { customerName: { contains: search, mode: 'insensitive' } },
      // phone: match with or without spaces / dashes
      { customerPhone: { contains: search.replace(/[\s-]/g, '') } },
      { productName: { contains: search, mode: 'insensitive' } },
      { city: { contains: search, mode: 'insensitive' } },
      { address: { contains: search, mode: 'insensitive' } },
      { supplier: { name: { contains: search, mode: 'insensitive' } } },
      { category: { name: { contains: search, mode: 'insensitive' } } },
      { paymentSource: { name: { contains: search, mode: 'insensitive' } } },
      { orderSource: { name: { contains: search, mode: 'insensitive' } } },
      { receivedBy: { name: { contains: search, mode: 'insensitive' } } },
      { externalOrderId: { contains: search.replace(/^#/, ''), mode: 'insensitive' } },
      { trackingNumber: { contains: search.replace(/^#/, ''), mode: 'insensitive' } },
    ]
    // "1045" or "#1045" also finds our own order number
    const asNumber = /^#?\d+$/.test(search.trim()) ? parseInt(search.trim().replace('#', ''), 10) : NaN
    if (!isNaN(asNumber)) where.OR.push({ orderNo: asNumber })
  }

  const startDate = searchParams.get('startDate')
  const endDate = searchParams.get('endDate')

  let dateFilter: any = {}

  if (startDate || endDate) {
    if (startDate) {
      const [sY, sM, sD] = startDate.split('-').map(Number)
      dateFilter.gte = new Date(sY, sM - 1, sD, 0, 0, 0, 0)
    }
    if (endDate) {
      const [eY, eM, eD] = endDate.split('-').map(Number)
      dateFilter.lte = new Date(eY, eM - 1, eD, 23, 59, 59, 999)
    }
  } else if (range !== 'all') {
    const now = new Date()

    if (range === 'today') {
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
      const [yearStr, monthStr] = range.split('-')
      const year = parseInt(yearStr, 10)
      const month = parseInt(monthStr, 10) - 1
      const startOfMonth = new Date(year, month, 1, 0, 0, 0, 0)
      const endOfMonth = new Date(year, month + 1, 0, 23, 59, 59, 999)
      dateFilter = { gte: startOfMonth, lte: endOfMonth }
    } else if (/^\d{4}$/.test(range)) {
      const year = parseInt(range, 10)
      const startOfYear = new Date(year, 0, 1, 0, 0, 0, 0)
      const endOfYear = new Date(year, 11, 31, 23, 59, 59, 999)
      dateFilter = { gte: startOfYear, lte: endOfYear }
    }
  }

  // "Older than N days" (e.g. supplier payments pending for 15+ days)
  if (!isNaN(olderThanDays) && olderThanDays > 0) {
    const cutoff = new Date()
    cutoff.setDate(cutoff.getDate() - olderThanDays)
    if (!dateFilter.lte || dateFilter.lte > cutoff) dateFilter.lte = cutoff
  }

  if (dateFilter.gte || dateFilter.lte) {
    where.createdAt = dateFilter
  }

  return where
}
