'use client'

import React, { useState, useEffect } from 'react'
import { X, Sparkles, Package, Truck, Fuel, Receipt, ChevronDown, ChevronUp, Check, Recycle, Plus } from 'lucide-react'
import { toast } from 'sonner'
import CreatableSelect, { SelectOption } from './CreatableSelect'

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
}

const RETURNED_SOURCE = '__returned__'
const OTHER_SOURCE = '__other__'

const emptyForm = {
  categoryId: '',
  productName: '',
  quantity: '1',
  costPrice: '',
  soldPrice: '',
  deliveryCharge: '',
  petrolCost: '',
  gstAmount: '',
  expectedAmount: '',
  customerName: '',
  city: '',
  address: '',
}

const inputClass =
  'w-full bg-white border border-slate-300 rounded-xl px-3 py-2 text-sm text-slate-800 focus:outline-none focus:border-emerald-500 transition'
const labelClass = 'block text-xs font-semibold text-slate-700 mb-1'

export default function QuickOrderForm({ isOpen, onClose, onSuccess }: QuickOrderFormProps) {
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
  // supplier id, OTHER_SOURCE (picking/creating a new one) or RETURNED_SOURCE
  const [source, setSource] = useState<string>('')
  const [returnedItemId, setReturnedItemId] = useState('')
  const [supplierPaid, setSupplierPaid] = useState(false)
  const [showCustomer, setShowCustomer] = useState(false)

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
      .then(([cats, sups, items, srcs, orderSrcs, ppl]) => {
        if (Array.isArray(ppl)) setPeople(ppl)
        if (Array.isArray(orderSrcs)) setOrderSources(orderSrcs)
        if (Array.isArray(srcs)) setPaymentSources(srcs)
        if (Array.isArray(cats)) setCategories(cats)
        if (Array.isArray(sups)) setSuppliers(sups)
        if (Array.isArray(items)) setReturnedItems(items)
      })
      .catch(console.error)
  }, [isOpen])

  const set = (key: keyof typeof emptyForm, value: string) =>
    setForm((prev) => ({ ...prev, [key]: value }))

  const createCategory = async (name: string) => {
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
    toast.success(`Category "${data.name}" created`)
    return data as SelectOption
  }

  const createSupplier = async (name: string) => {
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
    setSource(data.id)
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

  const handlePickReturnedItem = (id: string) => {
    setReturnedItemId(id)
    const item = returnedItems.find((i) => i.id === id)
    if (item) {
      setForm((prev) => ({
        ...prev,
        productName: item.productName,
        categoryId: item.categoryId || prev.categoryId,
        costPrice: item.costPrice.toString(),
        quantity: item.quantity.toString(),
      }))
    }
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
    setSource('')
    setReturnedItemId('')
    setSupplierPaid(false)
    setPaymentSourceId('')
    setOrderSourceId('')
    setReceivedById('')
    setShowCustomer(false)
    setError(null)
  }

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault()
    setError(null)

    if (!form.productName.trim() || !form.costPrice || !form.soldPrice) {
      setError('Product name, buy price and sale price are required.')
      return
    }
    if (source === RETURNED_SOURCE && !returnedItemId) {
      setError('Select an item from returned stock.')
      return
    }

    const isReturned = source === RETURNED_SOURCE
    const supplierId = !isReturned && source !== OTHER_SOURCE ? source : ''

    setIsSubmitting(true)
    try {
      const res = await fetch('/api/sales', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          ...form,
          supplierId: supplierId || null,
          returnedItemId: isReturned ? returnedItemId : null,
          supplierPaymentStatus: supplierPaid ? 'PAID' : 'PENDING',
          paymentSourceId: paymentSourceId && paymentSourceId !== OTHER_SOURCE ? paymentSourceId : null,
          orderSourceId: orderSourceId && orderSourceId !== OTHER_SOURCE ? orderSourceId : null,
          receivedById: receivedById && receivedById !== OTHER_SOURCE ? receivedById : null,
          expectedAmount: form.expectedAmount || null,
          categoryId: form.categoryId || null,
        }),
      })

      if (!res.ok) {
        const errData = await res.json()
        throw new Error(errData.error || 'Failed to create order')
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

  // Live profit summary
  const qty = parseInt(form.quantity, 10) || 1
  const cost = parseFloat(form.costPrice) || 0
  const sold = parseFloat(form.soldPrice) || 0
  const dc = parseFloat(form.deliveryCharge) || 0
  const petrol = parseFloat(form.petrolCost) || 0
  const gst = parseFloat(form.gstAmount) || 0
  const saleTotal = sold * qty
  const costTotal = cost * qty
  // What will actually reach the account (blank = full sale); the difference is a tax / fee cut
  const expected = form.expectedAmount !== '' && !isNaN(parseFloat(form.expectedAmount)) ? parseFloat(form.expectedAmount) : saleTotal
  const payoutCut = saleTotal - expected
  const profit = expected - costTotal - dc - petrol - gst
  const margin = saleTotal > 0 ? ((profit / saleTotal) * 100).toFixed(1) : '0.0'
  const formatPKR = (n: number) => `Rs. ${n.toLocaleString()}`

  const chipClass = (active: boolean) =>
    `px-3 py-1.5 rounded-xl text-xs font-semibold border transition flex items-center gap-1 ${
      active
        ? 'bg-emerald-500 text-white border-emerald-500 font-bold'
        : 'bg-slate-100 text-slate-700 border-slate-300 hover:border-slate-500'
    }`

  return (
    <div className="fixed inset-0 z-50 flex items-end sm:items-center justify-center sm:p-4 bg-slate-900/30 backdrop-blur-sm animate-in fade-in">
      <div className="bg-white border border-slate-200 rounded-t-2xl sm:rounded-2xl w-full max-w-lg shadow-2xl text-slate-900 flex flex-col max-h-[94dvh] sm:max-h-[92vh]">

        {/* Header */}
        <div className="flex items-center justify-between p-5 border-b border-slate-200">
          <div className="flex items-center gap-2">
            <div className="p-2 rounded-xl bg-emerald-500/10 text-emerald-600">
              <Sparkles className="h-5 w-5" />
            </div>
            <div>
              <h2 className="text-base font-bold">New Order</h2>
              <p className="text-xs text-slate-500">Quick entry: buy, sell, expenses</p>
            </div>
          </div>
          <button onClick={onClose} className="p-1 rounded-lg text-slate-500 hover:text-slate-900 transition">
            <X className="h-5 w-5" />
          </button>
        </div>

        <form onSubmit={handleSubmit} className="px-4 pt-4 sm:px-5 sm:pt-5 space-y-4 overflow-y-auto">
          {error && (
            <div className="p-3 bg-rose-500/10 border border-rose-500/30 text-rose-600 text-xs rounded-xl">{error}</div>
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

          {/* Category */}
          <div>
            <label className={labelClass}>Category</label>
            <CreatableSelect
              options={categories}
              value={form.categoryId}
              onChange={(id) => set('categoryId', id)}
              onCreate={createCategory}
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
                value={form.productName}
                onChange={(e) => set('productName', e.target.value)}
                placeholder="e.g. Corolla 2018 top cover"
                className={`${inputClass} pl-9`}
              />
            </div>
          </div>

          {/* Supplier / source */}
          <div>
            <label className={labelClass}>Bought from</label>
            <div className="flex flex-wrap gap-1.5">
              {suppliers.map((s) => (
                <button key={s.id} type="button" onClick={() => setSource(s.id)} className={chipClass(source === s.id)}>
                  {source === s.id && <Check className="h-3.5 w-3.5" />}
                  {s.name}
                </button>
              ))}
              <button type="button" onClick={() => setSource(OTHER_SOURCE)} className={chipClass(source === OTHER_SOURCE)}>
                <Plus className="h-3.5 w-3.5" /> Other
              </button>
              {returnedItems.length > 0 && (
                <button
                  type="button"
                  onClick={() => setSource(RETURNED_SOURCE)}
                  className={chipClass(source === RETURNED_SOURCE)}
                >
                  <Recycle className="h-3.5 w-3.5" /> Returned stock ({returnedItems.length})
                </button>
              )}
            </div>

            {source === OTHER_SOURCE && (
              <div className="mt-2">
                <CreatableSelect
                  options={suppliers}
                  value=""
                  onChange={(id) => id && setSource(id)}
                  onCreate={createSupplier}
                  placeholder="Type supplier name"
                  createLabel="Add supplier"
                  autoOpen
                />
              </div>
            )}

            {source === RETURNED_SOURCE && (
              <select
                value={returnedItemId}
                onChange={(e) => handlePickReturnedItem(e.target.value)}
                className={`${inputClass} mt-2`}
              >
                <option value="">-- Select returned item --</option>
                {returnedItems.map((i) => (
                  <option key={i.id} value={i.id}>
                    {i.productName} x{i.quantity} — cost Rs. {i.costPrice} ({new Date(i.createdAt).toLocaleDateString()})
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
                value={form.quantity}
                onChange={(e) => set('quantity', e.target.value)}
                className={inputClass}
              />
            </div>
            <div>
              <label className={labelClass}>Buy price *</label>
              <input
                type="number"
                step="0.01"
                value={form.costPrice}
                onChange={(e) => set('costPrice', e.target.value)}
                placeholder="1200"
                className={inputClass}
              />
            </div>
            <div>
              <label className={labelClass}>Sale price *</label>
              <input
                type="number"
                step="0.01"
                value={form.soldPrice}
                onChange={(e) => set('soldPrice', e.target.value)}
                placeholder="2200"
                className={inputClass}
              />
            </div>
          </div>

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
            <label className={labelClass}>Expected to receive (Rs)</label>
            <input
              type="number"
              step="0.01"
              min="0"
              value={form.expectedAmount}
              onChange={(e) => set('expectedAmount', e.target.value)}
              placeholder={saleTotal > 0 ? `${saleTotal} (same as sale)` : 'Same as sale price'}
              className={inputClass}
            />
            <p className="text-[11px] text-slate-500 mt-1">
              Leave blank if the full sale amount will come. You can change it when the payment arrives.
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

          {/* Supplier payment */}
          {source !== RETURNED_SOURCE && (
            <div className="flex items-center justify-between bg-slate-100/50 border border-slate-300/60 rounded-xl px-3 py-2">
              <span className="text-xs font-semibold text-slate-700">Supplier payment</span>
              <div className="flex gap-1">
                <button
                  type="button"
                  onClick={() => setSupplierPaid(false)}
                  className={`px-3 py-1 rounded-lg text-[11px] font-bold transition ${
                    !supplierPaid ? 'bg-amber-500 text-white' : 'bg-slate-100 text-slate-500'
                  }`}
                >
                  Pending
                </button>
                <button
                  type="button"
                  onClick={() => setSupplierPaid(true)}
                  className={`px-3 py-1 rounded-lg text-[11px] font-bold transition ${
                    supplierPaid ? 'bg-emerald-500 text-white' : 'bg-slate-100 text-slate-500'
                  }`}
                >
                  Paid
                </button>
              </div>
            </div>
          )}

          {/* Expenses */}
          <div>
            <label className={labelClass}>
              Expenses (Rs){' '}
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
          </div>

          {/* Customer (optional) */}
          <div className="border border-slate-200 rounded-xl">
            <button
              type="button"
              onClick={() => setShowCustomer((v) => !v)}
              className="w-full px-3 py-2 text-xs font-semibold text-slate-500 hover:text-slate-800 flex items-center justify-between"
            >
              Customer details (optional)
              {showCustomer ? <ChevronUp className="h-4 w-4" /> : <ChevronDown className="h-4 w-4" />}
            </button>
            {showCustomer && (
              <div className="p-3 pt-0 space-y-3">
                <input
                  type="text"
                  value={form.customerName}
                  onChange={(e) => set('customerName', e.target.value)}
                  placeholder="Customer name"
                  className={inputClass}
                />
                <input
                  type="text"
                  value={form.city}
                  onChange={(e) => handleCityChange(e.target.value)}
                  placeholder="City (fills DC automatically)"
                  className={inputClass}
                />
                <input
                  type="text"
                  value={form.address}
                  onChange={(e) => set('address', e.target.value)}
                  placeholder="Address"
                  className={inputClass}
                />
              </div>
            )}
          </div>

          {/* Live summary */}
          <div className="bg-slate-100/60 border border-slate-300/80 rounded-xl p-3 space-y-1.5 text-xs font-mono">
            <div className="flex justify-between">
              <span className="text-slate-500">Sale</span>
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

          {/* Stays visible at the bottom while the form scrolls (phones) */}
          <div className="sticky bottom-0 -mx-4 sm:-mx-5 px-4 sm:px-5 pt-2 pb-[max(1rem,env(safe-area-inset-bottom))] bg-white border-t border-slate-100">
            <button
              type="submit"
              disabled={isSubmitting}
              className="w-full py-3 bg-emerald-500 hover:bg-emerald-600 text-white font-bold text-sm rounded-xl flex items-center justify-center gap-1.5 transition shadow-lg shadow-emerald-500/20 disabled:opacity-50"
            >
              <Check className="h-4 w-4" />
              {isSubmitting ? 'Saving...' : `Save Order · Profit ${formatPKR(profit)}`}
            </button>
          </div>
        </form>
      </div>
    </div>
  )
}
