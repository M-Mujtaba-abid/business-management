'use client'

import React, { useState, useEffect } from 'react'
import { X, Sparkles, Package, Truck, Fuel, Receipt, Check, Recycle, Plus, Trash2, Pencil, Lock } from 'lucide-react'
import { toast } from 'sonner'
import CreatableSelect, { SelectOption } from './CreatableSelect'
import type { Sale } from '../OrderList'
import { formatDateTime } from '@/lib/format'

interface ReturnedItem {
  id: string
  productName: string
  categoryId: string | null
  costPrice: number
  quantity: number
  createdAt: string
}

interface QuickOrderFormProps {
  isOpen: boolean
  onClose: () => void
  onSuccess: () => void
  // When set, the form edits this saved order (its products) instead of creating a new one
  editItems?: Sale[] | null
}

const RETURNED_SOURCE = '__returned__'
const OTHER_SOURCE = '__other__'

// One product in the order (a parcel can hold several)
interface ItemDraft {
  key: string
  id?: string // saved product row (edit mode)
  // edit mode: what was saved, to warn before changing a product whose supplier is already paid
  saved?: { costPrice: number; quantity: number; source: string; supplierPaid: boolean }
  returnedLabel?: string // edit mode: name of the returned cover this product already uses
  categoryId: string
  productName: string
  // supplier id, OTHER_SOURCE (picking/creating a new one) or RETURNED_SOURCE
  source: string
  returnedItemId: string
  quantity: string
  costPrice: string
  soldPrice: string
  supplierPaid: boolean
}

const newItem = (): ItemDraft => ({
  key: Math.random().toString(36).slice(2),
  categoryId: '',
  productName: '',
  source: '',
  returnedItemId: '',
  quantity: '1',
  costPrice: '',
  soldPrice: '',
  supplierPaid: false,
})

// Fields shared by the whole order / parcel
// Local "YYYY-MM-DDTHH:mm" for a datetime-local input
const toLocalInput = (d: Date) => {
  const pad = (n: number) => String(n).padStart(2, '0')
  return `${d.getFullYear()}-${pad(d.getMonth() + 1)}-${pad(d.getDate())}T${pad(d.getHours())}:${pad(d.getMinutes())}`
}

const emptyForm = {
  deliveryCharge: '',
  petrolCost: '',
  gstAmount: '',
  expectedAmount: '',
  customerName: '',
  city: '',
  address: '',
  externalOrderId: '', // Daraz / Website order ID
  trackingNumber: '', // courier (Leopards...) tracking number
  orderDate: '', // when the order was taken (datetime-local); filled with "now" when the form opens
}

const inputClass =
  'w-full bg-white border border-slate-300 rounded-xl px-3 py-2 text-sm text-slate-800 focus:outline-none focus:border-emerald-500 transition'
const labelClass = 'block text-xs font-semibold text-slate-700 mb-1'

export default function QuickOrderForm({ isOpen, onClose, onSuccess, editItems }: QuickOrderFormProps) {
  const isEdit = Boolean(editItems && editItems.length)
  const lead = isEdit ? editItems![0] : null
  // Returned order: money is settled, only names / categories / customer / sources can change
  const moneyLocked = lead?.status === 'RETURNED'
  // Payment already received: the actual amount is changed with "Edit amount" in order details
  const payoutLocked = lead?.paymentStatus === 'RECEIVED'
  const [categories, setCategories] = useState<SelectOption[]>([])
  const [suppliers, setSuppliers] = useState<SelectOption[]>([])
  const [paymentSources, setPaymentSources] = useState<(SelectOption & { lastReceivedById?: string | null })[]>([])
  const [people, setPeople] = useState<SelectOption[]>([])
  // person id, or OTHER_SOURCE while picking/creating a new one
  const [receivedById, setReceivedById] = useState('')
  const [orderSources, setOrderSources] = useState<SelectOption[]>([])
  // order source id, or OTHER_SOURCE while picking/creating a new one
  const [orderSourceId, setOrderSourceId] = useState('')
  // payment source id, or OTHER_SOURCE while picking/creating a new one
  const [paymentSourceId, setPaymentSourceId] = useState('')
  const [returnedItems, setReturnedItems] = useState<ReturnedItem[]>([])

  const [form, setForm] = useState(emptyForm)
  const [items, setItems] = useState<ItemDraft[]>([newItem()])
  const [showOrderIdField, setShowOrderIdField] = useState(false)

  const [isLoadingCityFee, setIsLoadingCityFee] = useState(false)
  const [isSubmitting, setIsSubmitting] = useState(false)
  const [error, setError] = useState<string | null>(null)

  useEffect(() => {
    if (!isOpen) return
    Promise.all([
      fetch('/api/categories').then((r) => r.json()),
      fetch('/api/suppliers').then((r) => r.json()),
      fetch('/api/returned-items').then((r) => r.json()),
      fetch('/api/payment-sources').then((r) => r.json()),
      fetch('/api/order-sources').then((r) => r.json()),
      fetch('/api/people').then((r) => r.json()),
    ])
      .then(([cats, sups, rItems, srcs, orderSrcs, ppl]) => {
        if (Array.isArray(ppl)) setPeople(ppl)
        if (Array.isArray(orderSrcs)) setOrderSources(orderSrcs)
        if (Array.isArray(srcs)) setPaymentSources(srcs)
        if (Array.isArray(cats)) setCategories(cats)
        if (Array.isArray(sups)) setSuppliers(sups)
        if (Array.isArray(rItems)) setReturnedItems(rItems)
      })
      .catch(console.error)
  }, [isOpen])

  // New order: the date starts at "now" each time the form opens
  useEffect(() => {
    if (!isOpen || (editItems && editItems.length)) return
    setForm((prev) => ({ ...prev, orderDate: toLocalInput(new Date()) }))
  }, [isOpen, editItems])

  // Edit mode: fill the form from the saved order
  useEffect(() => {
    if (!isOpen || !editItems || editItems.length === 0) return
    const first = editItems[0]
    const sum = (f: (s: Sale) => number) => Math.round(editItems.reduce((a, s) => a + f(s), 0) * 100) / 100
    const hasPayoutEdit = editItems.some((s) => s.receivedAmount != null)
    setForm({
      deliveryCharge: String(sum((s) => s.deliveryCharge) || ''),
      petrolCost: String(sum((s) => s.petrolCost || 0) || ''),
      gstAmount: String(sum((s) => s.gstAmount || 0) || ''),
      expectedAmount: hasPayoutEdit ? String(sum((s) => s.receivedAmount ?? s.soldPrice * s.quantity)) : '',
      customerName: first.customerName === 'Walk-in' ? '' : first.customerName,
      city: first.city === 'General' ? '' : first.city,
      address: first.address || '',
      externalOrderId: first.externalOrderId || '',
      trackingNumber: first.trackingNumber || '',
      orderDate: toLocalInput(new Date(first.createdAt)),
    })
    setItems(
      editItems.map((s) => {
        const source = s.returnedItemId ? RETURNED_SOURCE : s.supplier?.id || ''
        const supplierPaid = s.supplierPaymentStatus === 'PAID'
        return {
          key: s.id,
          id: s.id,
          categoryId: s.category?.id || '',
          productName: s.productName,
          source,
          returnedItemId: s.returnedItemId || '',
          returnedLabel: s.returnedItemId ? s.productName : undefined,
          quantity: String(s.quantity),
          costPrice: String(s.costPrice),
          soldPrice: String(s.soldPrice),
          supplierPaid,
          saved: { costPrice: s.costPrice, quantity: s.quantity, source, supplierPaid },
        }
      })
    )
    setOrderSourceId(first.orderSource?.id || '')
    setPaymentSourceId(first.paymentSource?.id || '')
    setReceivedById(first.receivedBy?.id || '')
    setError(null)
  }, [isOpen, editItems])

  const handleClose = () => {
    if (isEdit) resetForm() // a later "New Order" starts empty
    onClose()
  }

  // Picking a different supplier means a new purchase: its payment starts as Pending
  const chooseSupplier = (key: string, source: string) =>
    setItems((prev) => prev.map((it) => (it.key === key ? { ...it, source, supplierPaid: it.source === source ? it.supplierPaid : false } : it)))

  const set = (key: keyof typeof emptyForm, value: string) =>
    setForm((prev) => ({ ...prev, [key]: value }))

  const setItem = (key: string, patch: Partial<ItemDraft>) =>
    setItems((prev) => prev.map((it) => (it.key === key ? { ...it, ...patch } : it)))

  const addItem = () => setItems((prev) => [...prev, newItem()])
  const removeItem = (key: string) => setItems((prev) => (prev.length > 1 ? prev.filter((it) => it.key !== key) : prev))

  const createCategoryFor = (itemKey: string) => async (name: string) => {
    const res = await fetch('/api/categories', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ name }),
    })
    const data = await res.json()
    if (!res.ok) {
      toast.error(data.error || 'Failed to create category')
      return null
    }
    setCategories((prev) =>
      prev.some((c) => c.id === data.id) ? prev : [...prev, data].sort((a, b) => a.name.localeCompare(b.name))
    )
    setItem(itemKey, { categoryId: data.id })
    toast.success(`Category "${data.name}" created`)
    return data as SelectOption
  }

  const createSupplierFor = (itemKey: string) => async (name: string) => {
    const res = await fetch('/api/suppliers', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ name }),
    })
    const data = await res.json()
    if (!res.ok) {
      toast.error(data.error || 'Failed to add supplier')
      return null
    }
    setSuppliers((prev) =>
      prev.some((s) => s.id === data.id) ? prev : [...prev, data].sort((a, b) => a.name.localeCompare(b.name))
    )
    setItem(itemKey, { source: data.id })
    return data as SelectOption
  }

  const createOrderSource = async (name: string) => {
    const res = await fetch('/api/order-sources', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ name }),
    })
    const data = await res.json()
    if (!res.ok) {
      toast.error(data.error || 'Failed to add order source')
      return null
    }
    setOrderSources((prev) =>
      prev.some((s) => s.id === data.id) ? prev : [...prev, data].sort((a, b) => a.name.localeCompare(b.name))
    )
    setOrderSourceId(data.id)
    return data as SelectOption
  }

  // Picking where the order came from also pre-selects who pays, when names match (e.g. Daraz → Daraz)
  const handlePickOrderSource = (id: string) => {
    const next = orderSourceId === id ? '' : id
    setOrderSourceId(next)
    const picked = orderSources.find((o) => o.id === next)
    if (picked && !paymentSourceId) {
      const samePayer = paymentSources.find((p) => p.name.toLowerCase() === picked.name.toLowerCase())
      if (samePayer) choosePaymentSource(samePayer.id)
    }
  }

  // Choosing who pays us also pre-fills whose account it usually lands in (last order from that source)
  const choosePaymentSource = (id: string) => {
    setPaymentSourceId(id)
    const src = paymentSources.find((p) => p.id === id)
    if (src?.lastReceivedById && (!receivedById || receivedById === OTHER_SOURCE)) {
      setReceivedById(src.lastReceivedById)
    }
  }

  const createPerson = async (name: string) => {
    const res = await fetch('/api/people', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ name }),
    })
    const data = await res.json()
    if (!res.ok) {
      toast.error(data.error || 'Failed to add person')
      return null
    }
    setPeople((prev) =>
      prev.some((p) => p.id === data.id) ? prev : [...prev, data].sort((a, b) => a.name.localeCompare(b.name))
    )
    setReceivedById(data.id)
    return data as SelectOption
  }

  const createPaymentSource = async (name: string) => {
    const res = await fetch('/api/payment-sources', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ name }),
    })
    const data = await res.json()
    if (!res.ok) {
      toast.error(data.error || 'Failed to add payment source')
      return null
    }
    setPaymentSources((prev) =>
      prev.some((s) => s.id === data.id) ? prev : [...prev, data].sort((a, b) => a.name.localeCompare(b.name))
    )
    setPaymentSourceId(data.id)
    return data as SelectOption
  }

  const handlePickReturnedItem = (itemKey: string, id: string) => {
    const rItem = returnedItems.find((i) => i.id === id)
    setItems((prev) =>
      prev.map((it) =>
        it.key !== itemKey
          ? it
          : rItem
          ? {
              ...it,
              returnedItemId: id,
              productName: rItem.productName,
              categoryId: rItem.categoryId || it.categoryId,
              costPrice: rItem.costPrice.toString(),
              quantity: rItem.quantity.toString(),
            }
          : { ...it, returnedItemId: id }
      )
    )
  }

  const handleCityChange = async (cityName: string) => {
    set('city', cityName)
    if (!cityName.trim()) return

    setIsLoadingCityFee(true)
    try {
      const res = await fetch(`/api/cities/fee?city=${encodeURIComponent(cityName.trim())}`)
      const data = await res.json()
      if (data && typeof data.deliveryFee === 'number' && data.deliveryFee > 0) {
        setForm((prev) => ({ ...prev, deliveryCharge: data.deliveryFee.toString() }))
      }
    } catch (err) {
      console.error(err)
    } finally {
      setIsLoadingCityFee(false)
    }
  }

  const resetForm = () => {
    setForm(emptyForm)
    setItems([newItem()])
    setPaymentSourceId('')
    setOrderSourceId('')
    setReceivedById('')
    setShowOrderIdField(false)
    setError(null)
  }

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault()
    setError(null)

    // Daraz orders need the Daraz order ID, Website orders the Leopards tracking number
    const sourceName = (orderSources.find((o) => o.id === orderSourceId)?.name || '').trim().toLowerCase()
    if (sourceName === 'daraz' && !form.externalOrderId.trim()) {
      setError('Daraz Order ID is required for Daraz orders.')
      return
    }
    if (sourceName === 'website' && !form.trackingNumber.trim()) {
      setError('Leopards tracking number is required for Website orders.')
      return
    }

    if (!form.orderDate || isNaN(new Date(form.orderDate).getTime())) {
      setError('Pick the order date and time.')
      return
    }
    if (new Date(form.orderDate).getTime() > Date.now() + 5 * 60 * 1000) {
      setError('Order date cannot be in the future.')
      return
    }

    if (!form.customerName.trim() || !form.city.trim() || !form.address.trim()) {
      setError('Customer name, city and address are required.')
      return
    }

    for (const [i, it] of items.entries()) {
      const label = items.length > 1 ? `Product ${i + 1}: ` : ''
      if (!it.productName.trim() || !it.costPrice || !it.soldPrice) {
        setError(`${label}product name, buy price and sale price are required.`)
        return
      }
      if (it.source === RETURNED_SOURCE && !it.returnedItemId) {
        setError(`${label}select an item from returned stock.`)
        return
      }
    }

    if (isEdit && !moneyLocked) {
      const touchedPaid = items.filter(
        (it) =>
          it.saved?.supplierPaid &&
          (parseFloat(it.costPrice) !== it.saved.costPrice ||
            (parseInt(it.quantity, 10) || 1) !== it.saved.quantity ||
            it.source !== it.saved.source)
      )
      if (
        touchedPaid.length &&
        !confirm(
          `${touchedPaid.map((it) => it.productName).join(', ')}: the supplier is already paid. Changing its cost, quantity or supplier will change the supplier account. Save anyway?`
        )
      ) {
        return
      }
    }

    setIsSubmitting(true)
    try {
      const send = (allowDuplicate: boolean) => fetch(isEdit ? `/api/sales/${lead!.id}/edit` : '/api/sales', {
        method: isEdit ? 'PUT' : 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          ...form,
          allowDuplicate,
          // send with the browser's timezone so the server stores the exact moment;
          // when editing, only if the date was actually changed (keeps the saved seconds)
          orderDate:
            form.orderDate && !(isEdit && lead && form.orderDate === toLocalInput(new Date(lead.createdAt)))
              ? new Date(form.orderDate).toISOString()
              : null,
          items: items.map((it) => {
            const isReturned = it.source === RETURNED_SOURCE
            return {
              id: it.id,
              productName: it.productName,
              categoryId: it.categoryId || null,
              quantity: it.quantity,
              costPrice: it.costPrice,
              soldPrice: it.soldPrice,
              supplierId: !isReturned && it.source && it.source !== OTHER_SOURCE ? it.source : null,
              returnedItemId: isReturned ? it.returnedItemId : null,
              supplierPaymentStatus: it.supplierPaid ? 'PAID' : 'PENDING',
            }
          }),
          paymentSourceId: paymentSourceId && paymentSourceId !== OTHER_SOURCE ? paymentSourceId : null,
          orderSourceId: orderSourceId && orderSourceId !== OTHER_SOURCE ? orderSourceId : null,
          receivedById: receivedById && receivedById !== OTHER_SOURCE ? receivedById : null,
          expectedAmount: form.expectedAmount || null,
        }),
      })

      let res = await send(false)
      // Same order ID / tracking already saved on another order: ask before saving it twice
      if (res.status === 409) {
        const dup = await res.json()
        if (!confirm(`${dup.error}\n\nSave anyway?`)) return
        res = await send(true)
      }

      if (!res.ok) {
        const errData = await res.json()
        throw new Error(errData.error || (isEdit ? 'Failed to save changes' : 'Failed to create order'))
      }

      onSuccess()
      onClose()
      resetForm()
    } catch (err: any) {
      setError(err.message || 'Failed to create order')
    } finally {
      setIsSubmitting(false)
    }
  }

  if (!isOpen) return null

  // Live profit summary for the whole order
  const lineTotals = items.map((it) => {
    const qty = parseInt(it.quantity, 10) || 1
    return { sale: (parseFloat(it.soldPrice) || 0) * qty, cost: (parseFloat(it.costPrice) || 0) * qty }
  })
  const saleTotal = lineTotals.reduce((a, l) => a + l.sale, 0)
  const costTotal = lineTotals.reduce((a, l) => a + l.cost, 0)
  const dc = parseFloat(form.deliveryCharge) || 0
  const petrol = parseFloat(form.petrolCost) || 0
  const gst = parseFloat(form.gstAmount) || 0
  // What will actually reach the account (blank = full sale); the difference is a tax / fee cut
  const expected = form.expectedAmount !== '' && !isNaN(parseFloat(form.expectedAmount)) ? parseFloat(form.expectedAmount) : saleTotal
  const payoutCut = saleTotal - expected
  const profit = expected - costTotal - dc - petrol - gst
  const margin = saleTotal > 0 ? ((profit / saleTotal) * 100).toFixed(1) : '0.0'
  const formatPKR = (n: number) => `Rs. ${n.toLocaleString()}`
  const isParcel = items.length > 1

  // Field labels follow where the order came from / who delivers it
  const orderSourceName = (orderSources.find((o) => o.id === orderSourceId)?.name || '').trim().toLowerCase()
  // Required: Daraz → its order ID, Website → Leopards tracking number
  const orderIdLabel =
    orderSourceName === 'daraz' ? 'Daraz Order ID *' : orderSourceName === 'website' ? 'Website Order #' : ''
  const paymentSourceName = (paymentSources.find((p) => p.id === paymentSourceId)?.name || '').toLowerCase()
  const trackingLabel =
    orderSourceName === 'website'
      ? 'Leopards tracking number *'
      : paymentSourceName === 'leopards'
      ? 'Leopards tracking number'
      : 'Courier tracking number'
  const trackingRequired = orderSourceName === 'website'

  const chipClass = (active: boolean) =>
    `px-3 py-1.5 rounded-xl text-xs font-semibold border transition flex items-center gap-1 ${
      active
        ? 'bg-emerald-500 text-white border-emerald-500 font-bold'
        : 'bg-slate-100 text-slate-700 border-slate-300 hover:border-slate-500'
    }`

  return (
    <div className="fixed inset-0 z-50 flex items-end sm:items-center justify-center sm:p-4 bg-slate-900/30 backdrop-blur-sm animate-in fade-in">
      <div className="bg-white border border-slate-200 rounded-t-2xl sm:rounded-2xl w-full max-w-lg lg:max-w-5xl xl:max-w-6xl shadow-2xl text-slate-900 flex flex-col max-h-[94dvh] sm:max-h-[92vh] lg:h-[90vh] overflow-hidden">

        {/* Header */}
        <div className="flex items-center justify-between p-5 border-b border-slate-200">
          <div className="flex items-center gap-2">
            <div className={`p-2 rounded-xl ${isEdit ? 'bg-blue-500/10 text-blue-600' : 'bg-emerald-500/10 text-emerald-600'}`}>
              {isEdit ? <Pencil className="h-5 w-5" /> : <Sparkles className="h-5 w-5" />}
            </div>
            <div>
              <h2 className="text-base font-bold">{isEdit ? `Edit Order${lead?.orderNo ? ` #${lead.orderNo}` : ''}` : 'New Order'}</h2>
              <p className="text-xs text-slate-500">
                {isEdit && lead ? `Added ${formatDateTime(lead.createdAt)}` : ''}
                {isEdit && lead && isParcel ? ' · ' : ''}
                {isParcel ? `${items.length} products in one parcel` : isEdit ? '' : 'Quick entry: buy, sell, expenses'}
              </p>
            </div>
          </div>
          <button onClick={handleClose} className="p-1 rounded-lg text-slate-500 hover:text-slate-900 transition">
            <X className="h-5 w-5" />
          </button>
        </div>

        {/* Phones: one scrolling column. Laptops: products on the left, money + save on the right, each scrolling on its own */}
        <form
          onSubmit={handleSubmit}
          className="flex-1 min-h-0 overflow-y-auto lg:overflow-hidden lg:grid lg:grid-cols-[minmax(0,1fr)_400px] lg:grid-rows-[minmax(0,1fr)_auto]"
        >
          {/* Left: what was sold and to whom */}
          <div className="px-4 pt-4 sm:px-5 sm:pt-5 lg:p-6 space-y-4 lg:row-span-2 lg:overflow-y-auto">
            {error && (
              <div className="p-3 bg-rose-500/10 border border-rose-500/30 text-rose-600 text-xs rounded-xl">{error}</div>
            )}

            {moneyLocked && (
              <div className="p-3 bg-amber-50 border border-amber-200 text-amber-800 text-xs rounded-xl flex items-start gap-2">
                <Lock className="h-4 w-4 shrink-0 mt-0.5" />
                <span>This order is returned. You can change product names, categories, customer and sources. Prices, suppliers and expenses are locked.</span>
              </div>
            )}

            {/* Where the order came from */}
            <div className="bg-emerald-50/60 border border-emerald-100 rounded-xl p-3">
              <label className={labelClass}>Order from</label>
              <div className="flex flex-wrap gap-1.5">
                {orderSources.map((src) => (
                  <button
                    key={src.id}
                    type="button"
                    onClick={() => handlePickOrderSource(src.id)}
                    className={chipClass(orderSourceId === src.id)}
                  >
                    {orderSourceId === src.id && <Check className="h-3.5 w-3.5" />}
                    {src.name}
                  </button>
                ))}
                <button
                  type="button"
                  onClick={() => setOrderSourceId(OTHER_SOURCE)}
                  className={chipClass(orderSourceId === OTHER_SOURCE)}
                >
                  <Plus className="h-3.5 w-3.5" /> Other
                </button>
              </div>
              {orderSourceId === OTHER_SOURCE && (
                <div className="mt-2">
                  <CreatableSelect
                    options={orderSources}
                    value=""
                    onChange={(id) => id && setOrderSourceId(id)}
                    onCreate={createOrderSource}
                    placeholder="Type name (e.g. Instagram, WhatsApp)"
                    createLabel="Add"
                    autoOpen
                  />
                </div>
              )}
            </div>

            {/* Order date & time (defaults to now; pick an earlier one for orders entered late) */}
            <div>
              <label className={labelClass}>Order date & time</label>
              <input
                type="datetime-local"
                value={form.orderDate}
                max={toLocalInput(new Date())}
                onChange={(e) => set('orderDate', e.target.value)}
                className={inputClass}
              />
              {!isEdit && form.orderDate && form.orderDate.slice(0, 10) !== toLocalInput(new Date()).slice(0, 10) && (
                <p className="text-[11px] text-amber-600 mt-1">This order will be saved with an earlier date.</p>
              )}
            </div>

            {/* Order identity: marketplace order ID + courier tracking (both optional, can be added later with Edit) */}
            <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
              {orderIdLabel || showOrderIdField || form.externalOrderId ? (
                <div>
                  <label className={labelClass}>{orderIdLabel || 'Order ID'}</label>
                  <input
                    type="text"
                    value={form.externalOrderId}
                    onChange={(e) => set('externalOrderId', e.target.value)}
                    placeholder={orderIdLabel ? `e.g. ${orderSourceName === 'daraz' ? '204857361029' : 'WEB-1045'}` : 'Order ID'}
                    className={inputClass}
                  />
                </div>
              ) : (
                <div className="flex items-end">
                  <button
                    type="button"
                    onClick={() => setShowOrderIdField(true)}
                    className="text-xs font-semibold text-blue-600 hover:text-blue-700 pb-2"
                  >
                    + Add order ID
                  </button>
                </div>
              )}
              <div>
                <label className={labelClass}>{trackingLabel}</label>
                <input
                  type="text"
                  value={form.trackingNumber}
                  onChange={(e) => set('trackingNumber', e.target.value)}
                  placeholder={trackingRequired ? 'Required for Website orders' : "Optional — add later if you don't have it yet"}
                  className={inputClass}
                />
              </div>
            </div>

            {/* Customer (required) */}
            <div className="border border-slate-200 rounded-xl p-3 space-y-3">
              <div className="text-xs font-semibold text-slate-700">Customer details *</div>
              <input
                type="text"
                value={form.customerName}
                onChange={(e) => set('customerName', e.target.value)}
                placeholder="Customer name *"
                className={inputClass}
              />
              <input
                type="text"
                value={form.city}
                onChange={(e) => handleCityChange(e.target.value)}
                placeholder="City * (fills DC automatically)"
                className={inputClass}
              />
              <input
                type="text"
                value={form.address}
                onChange={(e) => set('address', e.target.value)}
                placeholder="Address *"
                className={inputClass}
              />
            </div>

            {/* Products */}
            <div className="space-y-3">
              {items.map((it, idx) => {
                // A returned cover can only go into one product line
                const takenElsewhere = new Set(items.filter((o) => o.key !== it.key).map((o) => o.returnedItemId).filter(Boolean))
                const availableReturned = returnedItems.filter((r) => !takenElsewhere.has(r.id))
                const line = lineTotals[idx]
                return (
                  <div key={it.key} className={`space-y-3 ${isParcel ? 'rounded-xl border border-slate-200 p-3' : ''}`}>
                    {isParcel && (
                      <div className="flex items-center justify-between">
                        <span className="text-xs font-bold text-slate-700">
                          Product {idx + 1}
                          {line.sale > 0 && <span className="font-normal text-slate-500"> · {formatPKR(line.sale)}</span>}
                        </span>
                        <button
                          type="button"
                          disabled={moneyLocked}
                          onClick={() => removeItem(it.key)}
                          className="p-1 rounded-lg text-slate-400 hover:text-rose-600 hover:bg-rose-50"
                          title="Remove product"
                        >
                          <Trash2 className="h-4 w-4" />
                        </button>
                      </div>
                    )}

                    {/* Category + product name side by side on wider screens */}
                    <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
                    {/* Category */}
                    <div>
                      <label className={labelClass}>Category</label>
                      <CreatableSelect
                        options={categories}
                        value={it.categoryId}
                        onChange={(id) => setItem(it.key, { categoryId: id })}
                        onCreate={createCategoryFor(it.key)}
                        placeholder="Select category (e.g. Car Top Cover)"
                        createLabel="Create category"
                      />
                    </div>

                    {/* Product name */}
                    <div>
                      <label className={labelClass}>Product / Cover *</label>
                      <div className="relative">
                        <Package className="absolute left-3 top-2.5 h-4 w-4 text-slate-500" />
                        <input
                          type="text"
                          value={it.productName}
                          onChange={(e) => setItem(it.key, { productName: e.target.value })}
                          placeholder="e.g. Corolla 2018 top cover"
                          className={`${inputClass} pl-9`}
                        />
                      </div>
                    </div>
                    </div>

                    <fieldset disabled={moneyLocked} className="space-y-3 disabled:opacity-60">
                    {/* Supplier / source */}
                    <div>
                      <label className={labelClass}>Bought from</label>
                      <div className="flex flex-wrap gap-1.5">
                        {suppliers.map((s) => (
                          <button key={s.id} type="button" onClick={() => chooseSupplier(it.key, s.id)} className={chipClass(it.source === s.id)}>
                            {it.source === s.id && <Check className="h-3.5 w-3.5" />}
                            {s.name}
                          </button>
                        ))}
                        <button type="button" onClick={() => chooseSupplier(it.key, OTHER_SOURCE)} className={chipClass(it.source === OTHER_SOURCE)}>
                          <Plus className="h-3.5 w-3.5" /> Other
                        </button>
                        {(availableReturned.length > 0 || it.returnedLabel) && (
                          <button
                            type="button"
                            onClick={() => chooseSupplier(it.key, RETURNED_SOURCE)}
                            className={chipClass(it.source === RETURNED_SOURCE)}
                          >
                            <Recycle className="h-3.5 w-3.5" /> Returned stock ({availableReturned.length})
                          </button>
                        )}
                      </div>

                      {it.source === OTHER_SOURCE && (
                        <div className="mt-2">
                          <CreatableSelect
                            options={suppliers}
                            value=""
                            onChange={(id) => id && chooseSupplier(it.key, id)}
                            onCreate={createSupplierFor(it.key)}
                            placeholder="Type supplier name"
                            createLabel="Add supplier"
                            autoOpen
                          />
                        </div>
                      )}

                      {it.source === RETURNED_SOURCE && (
                        <select
                          value={it.returnedItemId}
                          onChange={(e) => handlePickReturnedItem(it.key, e.target.value)}
                          className={`${inputClass} mt-2`}
                        >
                          <option value="">-- Select returned item --</option>
                          {it.returnedLabel && it.returnedItemId && !availableReturned.some((r) => r.id === it.returnedItemId) && (
                            <option value={it.returnedItemId}>{it.returnedLabel} (current)</option>
                          )}
                          {availableReturned.map((r) => (
                            <option key={r.id} value={r.id}>
                              {r.productName} x{r.quantity} — cost Rs. {r.costPrice} ({new Date(r.createdAt).toLocaleDateString()})
                            </option>
                          ))}
                        </select>
                      )}
                    </div>

                    {/* Pricing */}
                    <div className="grid grid-cols-3 gap-3">
                      <div>
                        <label className={labelClass}>Qty</label>
                        <input
                          type="number"
                          min="1"
                          value={it.quantity}
                          onChange={(e) => setItem(it.key, { quantity: e.target.value })}
                          className={inputClass}
                        />
                      </div>
                      <div>
                        <label className={labelClass}>Buy price *</label>
                        <input
                          type="number"
                          step="0.01"
                          value={it.costPrice}
                          onChange={(e) => setItem(it.key, { costPrice: e.target.value })}
                          placeholder="1200"
                          className={inputClass}
                        />
                      </div>
                      <div>
                        <label className={labelClass}>Sale price *</label>
                        <input
                          type="number"
                          step="0.01"
                          value={it.soldPrice}
                          onChange={(e) => setItem(it.key, { soldPrice: e.target.value })}
                          placeholder="2200"
                          className={inputClass}
                        />
                      </div>
                    </div>

                    {/* Supplier payment for this product */}
                    {it.source !== RETURNED_SOURCE && (
                      <div className="flex items-center justify-between bg-slate-100/50 border border-slate-300/60 rounded-xl px-3 py-2">
                        <span className="text-xs font-semibold text-slate-700">Supplier payment</span>
                        <div className="flex gap-1">
                          <button
                            type="button"
                            onClick={() => setItem(it.key, { supplierPaid: false })}
                            className={`px-3 py-1 rounded-lg text-[11px] font-bold transition ${
                              !it.supplierPaid ? 'bg-amber-500 text-white' : 'bg-slate-100 text-slate-500'
                            }`}
                          >
                            Pending
                          </button>
                          <button
                            type="button"
                            onClick={() => setItem(it.key, { supplierPaid: true })}
                            className={`px-3 py-1 rounded-lg text-[11px] font-bold transition ${
                              it.supplierPaid ? 'bg-emerald-500 text-white' : 'bg-slate-100 text-slate-500'
                            }`}
                          >
                            Paid
                          </button>
                        </div>
                      </div>
                    )}
                    </fieldset>
                  </div>
                )
              })}

              {!moneyLocked && (
              <button
                type="button"
                onClick={addItem}
                className="w-full py-2.5 rounded-xl border-2 border-dashed border-emerald-300 text-emerald-700 text-sm font-semibold hover:bg-emerald-50 flex items-center justify-center gap-1.5 transition"
              >
                <Plus className="h-4 w-4" /> Add another product
              </button>
              )}
            </div>

          </div>

          {/* Right: payment, expenses and the profit summary */}
          <div className="px-4 pt-4 pb-4 sm:px-5 lg:p-6 space-y-4 lg:overflow-y-auto lg:border-l lg:border-slate-200 lg:bg-slate-50/60">
            {/* Who pays us for this order */}
            <div>
              <label className={labelClass}>Payment from</label>
              <div className="flex flex-wrap gap-1.5">
                {paymentSources.map((src) => (
                  <button
                    key={src.id}
                    type="button"
                    onClick={() => (paymentSourceId === src.id ? setPaymentSourceId('') : choosePaymentSource(src.id))}
                    className={chipClass(paymentSourceId === src.id)}
                  >
                    {paymentSourceId === src.id && <Check className="h-3.5 w-3.5" />}
                    {src.name}
                  </button>
                ))}
                <button
                  type="button"
                  onClick={() => setPaymentSourceId(OTHER_SOURCE)}
                  className={chipClass(paymentSourceId === OTHER_SOURCE)}
                >
                  <Plus className="h-3.5 w-3.5" /> Other
                </button>
              </div>
              {paymentSourceId === OTHER_SOURCE && (
                <div className="mt-2">
                  <CreatableSelect
                    options={paymentSources}
                    value=""
                    onChange={(id) => id && choosePaymentSource(id)}
                    onCreate={createPaymentSource}
                    placeholder="Type name (e.g. TCS, Easypaisa)"
                    createLabel="Add"
                    autoOpen
                  />
                </div>
              )}
            </div>

            {/* Expected payout (Daraz / courier may cut tax or fees) */}
            <div>
              <label className={labelClass}>Expected to receive (Rs){isParcel ? ' — whole parcel' : ''}</label>
              <input
                type="number"
                step="0.01"
                min="0"
                disabled={moneyLocked || payoutLocked}
                value={form.expectedAmount}
                onChange={(e) => set('expectedAmount', e.target.value)}
                placeholder={saleTotal > 0 ? `${saleTotal} (same as sale)` : 'Same as sale price'}
                className={inputClass}
              />
              <p className="text-[11px] text-slate-500 mt-1">
                {payoutLocked
                  ? 'Payment is already received. Change the actual amount with "Edit amount" in order details.'
                  : 'Leave blank if the full sale amount will come. You can change it when the payment arrives.'}
              </p>
            </div>

            {/* Whose account the money lands in */}
            <div>
              <label className={labelClass}>Money goes to</label>
              <div className="flex flex-wrap gap-1.5">
                {people.map((p) => (
                  <button
                    key={p.id}
                    type="button"
                    onClick={() => setReceivedById(receivedById === p.id ? '' : p.id)}
                    className={chipClass(receivedById === p.id)}
                  >
                    {receivedById === p.id && <Check className="h-3.5 w-3.5" />}
                    {p.name}
                  </button>
                ))}
                <button
                  type="button"
                  onClick={() => setReceivedById(OTHER_SOURCE)}
                  className={chipClass(receivedById === OTHER_SOURCE)}
                >
                  <Plus className="h-3.5 w-3.5" /> Other
                </button>
              </div>
              {receivedById === OTHER_SOURCE && (
                <div className="mt-2">
                  <CreatableSelect
                    options={people}
                    value=""
                    onChange={(id) => id && setReceivedById(id)}
                    onCreate={createPerson}
                    placeholder="Type person name"
                    createLabel="Add"
                    autoOpen
                  />
                </div>
              )}
            </div>

            {/* Expenses (whole parcel) */}
            <fieldset disabled={moneyLocked} className="disabled:opacity-60">
              <label className={labelClass}>
                Expenses (Rs){isParcel ? ' — whole parcel' : ''}{' '}
                {isLoadingCityFee && <span className="text-[10px] text-emerald-600 animate-pulse">(loading DC...)</span>}
              </label>
              <div className="grid grid-cols-3 gap-3">
                <div className="relative">
                  <Truck className="hidden sm:block absolute left-3 top-2.5 h-4 w-4 text-slate-500" />
                  <input
                    type="number"
                    step="0.01"
                    value={form.deliveryCharge}
                    onChange={(e) => set('deliveryCharge', e.target.value)}
                    placeholder="DC"
                    className={`${inputClass} sm:pl-9`}
                  />
                </div>
                <div className="relative">
                  <Fuel className="hidden sm:block absolute left-3 top-2.5 h-4 w-4 text-slate-500" />
                  <input
                    type="number"
                    step="0.01"
                    value={form.petrolCost}
                    onChange={(e) => set('petrolCost', e.target.value)}
                    placeholder="Petrol"
                    className={`${inputClass} sm:pl-9`}
                  />
                </div>
                <div className="relative">
                  <Receipt className="hidden sm:block absolute left-3 top-2.5 h-4 w-4 text-slate-500" />
                  <input
                    type="number"
                    step="0.01"
                    value={form.gstAmount}
                    onChange={(e) => set('gstAmount', e.target.value)}
                    placeholder="GST"
                    className={`${inputClass} sm:pl-9`}
                  />
                </div>
              </div>
            </fieldset>

            {/* Live summary */}
            <div className="bg-slate-100/60 border border-slate-300/80 rounded-xl p-3 space-y-1.5 text-xs font-mono">
              <div className="flex justify-between">
                <span className="text-slate-500">Sale{isParcel ? ` (${items.length} products)` : ''}</span>
                <span className="text-slate-800">{formatPKR(saleTotal)}</span>
              </div>
              <div className="flex justify-between">
                <span className="text-slate-500">− Cover cost</span>
                <span className="text-slate-700">{formatPKR(costTotal)}</span>
              </div>
              <div className="flex justify-between">
                <span className="text-slate-500">− DC + Petrol + GST</span>
                <span className="text-slate-700">{formatPKR(dc + petrol + gst)}</span>
              </div>
              {Math.abs(payoutCut) >= 0.5 && (
                <div className="flex justify-between">
                  <span className="text-slate-500">{payoutCut > 0 ? '− Payment cut (tax / fees)' : '+ Extra received'}</span>
                  <span className="text-slate-700">{formatPKR(Math.abs(payoutCut))}</span>
                </div>
              )}
              <div className="flex justify-between pt-1.5 border-t border-slate-300/60 text-sm font-bold">
                <span className={profit >= 0 ? 'text-emerald-600' : 'text-rose-600'}>Profit</span>
                <span className={profit >= 0 ? 'text-emerald-600' : 'text-rose-600'}>
                  {formatPKR(profit)} ({margin}%)
                </span>
              </div>
            </div>

          </div>

          {/* Save: stays visible at the bottom on phones; bottom of the right column on laptops */}
          <div className="sticky bottom-0 px-4 sm:px-5 pt-2 pb-[max(1rem,env(safe-area-inset-bottom))] bg-white border-t border-slate-100 lg:static lg:col-start-2 lg:px-6 lg:pt-3 lg:pb-5 lg:border-l lg:border-slate-200 lg:bg-slate-50/60">
            <button
              type="submit"
              disabled={isSubmitting}
              className="w-full py-3 bg-emerald-500 hover:bg-emerald-600 text-white font-bold text-sm rounded-xl flex items-center justify-center gap-1.5 transition shadow-lg shadow-emerald-500/20 disabled:opacity-50"
            >
              <Check className="h-4 w-4" />
              {isSubmitting
                ? 'Saving...'
                : isEdit
                ? `Save changes${isParcel ? ` (${items.length} items)` : ''}`
                : `Save Order${isParcel ? ` (${items.length} items)` : ''} · Profit ${formatPKR(profit)}`}
            </button>
          </div>
        </form>
      </div>
    </div>
  )
}
