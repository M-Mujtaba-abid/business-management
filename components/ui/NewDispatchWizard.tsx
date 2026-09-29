'use client'

import React, { useState, useEffect } from 'react'
import { X, Sparkles, MapPin, Package, User, Truck, Check, ArrowRight, ArrowLeft } from 'lucide-react'

interface Product {
  id: string
  name: string
  costPrice: number
  salePrice: number
  stockQty: number
}

interface NewDispatchWizardProps {
  isOpen: boolean
  onClose: () => void
  onSuccess: () => void
}

export default function NewDispatchWizard({ isOpen, onClose, onSuccess }: NewDispatchWizardProps) {
  const [step, setStep] = useState<1 | 2 | 3>(1)
  const [products, setProducts] = useState<Product[]>([])
  const [selectedProductId, setSelectedProductId] = useState<string>('')
  
  const [formData, setFormData] = useState({
    productName: '',
    customerName: '',
    address: '',
    city: '',
    quantity: '1',
    costPrice: '',
    soldPrice: '',
    deliveryCharge: '0',
    deductDeliveryOnReturn: true,
  })

  const [isLoadingCityFee, setIsLoadingCityFee] = useState(false)
  const [isSubmitting, setIsSubmitting] = useState(false)
  const [error, setError] = useState<string | null>(null)

  useEffect(() => {
    if (isOpen) {
      fetch('/api/products')
        .then((res) => res.json())
        .then((data) => {
          if (Array.isArray(data)) setProducts(data)
        })
        .catch(console.error)
    }
  }, [isOpen])

  const handleProductChange = (productId: string) => {
    setSelectedProductId(productId)
    const found = products.find((p) => p.id === productId)
    if (found) {
      setFormData((prev) => ({
        ...prev,
        productName: found.name,
        costPrice: found.costPrice.toString(),
        soldPrice: found.salePrice.toString(),
      }))
    }
  }

  const handleCityChange = async (cityName: string) => {
    setFormData((prev) => ({ ...prev, city: cityName }))
    if (!cityName.trim()) return

    setIsLoadingCityFee(true)
    try {
      const res = await fetch(`/api/cities/fee?city=${encodeURIComponent(cityName.trim())}`)
      const data = await res.json()
      if (data && typeof data.deliveryFee === 'number' && data.deliveryFee > 0) {
        setFormData((prev) => ({ ...prev, deliveryCharge: data.deliveryFee.toString() }))
      }
    } catch (err) {
      console.error(err)
    } finally {
      setIsLoadingCityFee(false)
    }
  }

  const handleNextStep = () => {
    setError(null)
    if (step === 1) {
      if (!formData.customerName.trim() || !formData.city.trim() || !formData.address.trim()) {
        setError('Please fill in Customer Name, City, and Address.')
        return
      }
      setStep(2)
    } else if (step === 2) {
      if (!formData.productName.trim() || !formData.costPrice || !formData.soldPrice) {
        setError('Please specify Product Name, Cost Price, and Selling Price.')
        return
      }
      setStep(3)
    }
  }

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault()
    setError(null)
    setIsSubmitting(true)

    try {
      const res = await fetch('/api/sales', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          ...formData,
          productId: selectedProductId || null,
        }),
      })

      if (!res.ok) {
        const errData = await res.json()
        throw new Error(errData.error || 'Failed to create dispatch order')
      }

      onSuccess()
      onClose()
      setStep(1)
      setFormData({
        productName: '',
        customerName: '',
        address: '',
        city: '',
        quantity: '1',
        costPrice: '',
        soldPrice: '',
        deliveryCharge: '0',
        deductDeliveryOnReturn: true,
      })
      setSelectedProductId('')
    } catch (err: any) {
      setError(err.message || 'Failed to submit dispatch')
    } finally {
      setIsSubmitting(false)
    }
  }

  if (!isOpen) return null

  // Calculate estimated totals for step 3 review
  const qty = parseInt(formData.quantity, 10) || 1
  const cost = parseFloat(formData.costPrice) || 0
  const sold = parseFloat(formData.soldPrice) || 0
  const delivery = parseFloat(formData.deliveryCharge) || 0
  const productTotal = sold * qty
  const estimatedProfit = (sold - cost) * qty - delivery

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-slate-900/30 backdrop-blur-sm animate-in fade-in">
      <div className="bg-white border border-slate-200 rounded-2xl w-full max-w-lg shadow-2xl text-slate-900 overflow-hidden flex flex-col">
        
        {/* Top Header */}
        <div className="flex items-center justify-between p-5 border-b border-slate-200 bg-white/50">
          <div className="flex items-center gap-2">
            <div className="p-2 rounded-xl bg-emerald-500/10 text-emerald-600">
              <Sparkles className="h-5 w-5" />
            </div>
            <div>
              <h2 className="text-base font-bold">New Order Dispatch</h2>
              <p className="text-xs text-slate-500">Step {step} of 3 — {step === 1 ? 'Customer Info' : step === 2 ? 'Order Details' : 'Review & Confirm'}</p>
            </div>
          </div>
          <button onClick={onClose} className="p-1 rounded-lg text-slate-500 hover:text-slate-900 transition">
            <X className="h-5 w-5" />
          </button>
        </div>

        {/* Step Progress Bar */}
        <div className="grid grid-cols-3 bg-slate-50/40 border-b border-slate-200 text-[11px] font-semibold text-center py-2 px-4">
          <span className={step >= 1 ? 'text-emerald-600' : 'text-slate-500'}>1. Customer</span>
          <span className={step >= 2 ? 'text-emerald-600' : 'text-slate-500'}>2. Product & Price</span>
          <span className={step === 3 ? 'text-emerald-600' : 'text-slate-500'}>3. Review</span>
        </div>

        {/* Body Form */}
        <form onSubmit={handleSubmit} className="p-6 space-y-4">
          {error && (
            <div className="p-3 bg-rose-500/10 border border-rose-500/30 text-rose-600 text-xs rounded-xl">
              {error}
            </div>
          )}

          {/* STEP 1: CUSTOMER */}
          {step === 1 && (
            <div className="space-y-4 animate-in fade-in">
              <div>
                <label className="block text-xs font-semibold text-slate-700 mb-1">Customer Full Name *</label>
                <div className="relative">
                  <User className="absolute left-3 top-2.5 h-4 w-4 text-slate-500" />
                  <input
                    type="text"
                    required
                    value={formData.customerName}
                    onChange={(e) => setFormData((prev) => ({ ...prev, customerName: e.target.value }))}
                    placeholder="e.g. John Doe"
                    className="w-full bg-slate-100 border border-slate-300 rounded-xl pl-9 pr-3 py-2 text-sm text-slate-800 focus:outline-none focus:border-emerald-500 transition"
                  />
                </div>
              </div>

              <div>
                <label className="block text-xs font-semibold text-slate-700 mb-1">
                  City * {isLoadingCityFee && <span className="text-[10px] text-emerald-600 animate-pulse">(fetching delivery rate...)</span>}
                </label>
                <div className="relative">
                  <MapPin className="absolute left-3 top-2.5 h-4 w-4 text-slate-500" />
                  <input
                    type="text"
                    required
                    value={formData.city}
                    onChange={(e) => handleCityChange(e.target.value)}
                    placeholder="e.g. Lahore, Karachi, Islamabad"
                    className="w-full bg-slate-100 border border-slate-300 rounded-xl pl-9 pr-3 py-2 text-sm text-slate-800 focus:outline-none focus:border-emerald-500 transition"
                  />
                </div>
              </div>

              <div>
                <label className="block text-xs font-semibold text-slate-700 mb-1">Full Shipping Address *</label>
                <input
                  type="text"
                  required
                  value={formData.address}
                  onChange={(e) => setFormData((prev) => ({ ...prev, address: e.target.value }))}
                  placeholder="House #, Street name, Sector/Area"
                  className="w-full bg-slate-100 border border-slate-300 rounded-xl px-3 py-2 text-sm text-slate-800 focus:outline-none focus:border-emerald-500 transition"
                />
              </div>
            </div>
          )}

          {/* STEP 2: PRODUCT & PRICING */}
          {step === 2 && (
            <div className="space-y-4 animate-in fade-in">
              <div>
                <label className="block text-xs font-semibold text-slate-700 mb-1">Select Existing Catalog Product (Optional)</label>
                <select
                  value={selectedProductId}
                  onChange={(e) => handleProductChange(e.target.value)}
                  className="w-full bg-slate-100 border border-slate-300 rounded-xl px-3 py-2 text-sm text-slate-800 focus:outline-none focus:border-emerald-500 transition"
                >
                  <option value="">-- Choose from Catalog --</option>
                  {products.map((p) => (
                    <option key={p.id} value={p.id}>
                      {p.name} (Stock: {p.stockQty}) — Rs. {p.salePrice}
                    </option>
                  ))}
                </select>
              </div>

              <div>
                <label className="block text-xs font-semibold text-slate-700 mb-1">Product Name *</label>
                <div className="relative">
                  <Package className="absolute left-3 top-2.5 h-4 w-4 text-slate-500" />
                  <input
                    type="text"
                    required
                    value={formData.productName}
                    onChange={(e) => setFormData((prev) => ({ ...prev, productName: e.target.value }))}
                    placeholder="Product Item Name"
                    className="w-full bg-slate-100 border border-slate-300 rounded-xl pl-9 pr-3 py-2 text-sm text-slate-800 focus:outline-none focus:border-emerald-500 transition"
                  />
                </div>
              </div>

              <div className="grid grid-cols-3 gap-3">
                <div>
                  <label className="block text-xs font-semibold text-slate-700 mb-1">Quantity</label>
                  <input
                    type="number"
                    min="1"
                    required
                    value={formData.quantity}
                    onChange={(e) => setFormData((prev) => ({ ...prev, quantity: e.target.value }))}
                    className="w-full bg-slate-100 border border-slate-300 rounded-xl px-3 py-2 text-sm text-slate-800 focus:outline-none focus:border-emerald-500 transition"
                  />
                </div>
                <div>
                  <label className="block text-xs font-semibold text-slate-700 mb-1">Cost Price (Rs) *</label>
                  <input
                    type="number"
                    step="0.01"
                    required
                    value={formData.costPrice}
                    onChange={(e) => setFormData((prev) => ({ ...prev, costPrice: e.target.value }))}
                    placeholder="1200"
                    className="w-full bg-slate-100 border border-slate-300 rounded-xl px-3 py-2 text-sm text-slate-800 focus:outline-none focus:border-emerald-500 transition"
                  />
                </div>
                <div>
                  <label className="block text-xs font-semibold text-slate-700 mb-1">Selling Price (Rs) *</label>
                  <input
                    type="number"
                    step="0.01"
                    required
                    value={formData.soldPrice}
                    onChange={(e) => setFormData((prev) => ({ ...prev, soldPrice: e.target.value }))}
                    placeholder="2200"
                    className="w-full bg-slate-100 border border-slate-300 rounded-xl px-3 py-2 text-sm text-slate-800 focus:outline-none focus:border-emerald-500 transition"
                  />
                </div>
              </div>

              <div>
                <label className="block text-xs font-semibold text-slate-700 mb-1">Delivery Charge (Rs)</label>
                <div className="relative">
                  <Truck className="absolute left-3 top-2.5 h-4 w-4 text-slate-500" />
                  <input
                    type="number"
                    step="0.01"
                    value={formData.deliveryCharge}
                    onChange={(e) => setFormData((prev) => ({ ...prev, deliveryCharge: e.target.value }))}
                    placeholder="250"
                    className="w-full bg-slate-100 border border-slate-300 rounded-xl pl-9 pr-3 py-2 text-sm text-slate-800 focus:outline-none focus:border-emerald-500 transition"
                  />
                </div>
              </div>
            </div>
          )}

          {/* STEP 3: REVIEW & CONFIRM */}
          {step === 3 && (
            <div className="space-y-4 animate-in fade-in">
              <div className="bg-slate-100/60 border border-slate-300/80 rounded-xl p-4 space-y-3 text-xs">
                <div className="flex justify-between border-b border-slate-300/60 pb-2">
                  <span className="text-slate-500">Customer:</span>
                  <span className="font-semibold text-slate-900">{formData.customerName} ({formData.city})</span>
                </div>
                <div className="flex justify-between border-b border-slate-300/60 pb-2">
                  <span className="text-slate-500">Address:</span>
                  <span className="text-slate-700">{formData.address}</span>
                </div>
                <div className="flex justify-between border-b border-slate-300/60 pb-2">
                  <span className="text-slate-500">Item:</span>
                  <span className="font-semibold text-slate-900">{formData.productName} x {formData.quantity}</span>
                </div>
                <div className="flex justify-between border-b border-slate-300/60 pb-2">
                  <span className="text-slate-500">Product Sold Total:</span>
                  <span className="font-mono text-slate-800">Rs. {productTotal.toLocaleString()}</span>
                </div>
                <div className="flex justify-between border-b border-slate-300/60 pb-2">
                  <span className="text-slate-500">Delivery Charge:</span>
                  <span className="font-mono text-slate-700">Rs. {delivery.toLocaleString()}</span>
                </div>
                <div className="flex justify-between items-center pt-1 text-sm font-bold">
                  <span className="text-emerald-600">Estimated Profit:</span>
                  <span className="font-mono text-emerald-600">Rs. {estimatedProfit.toLocaleString()}</span>
                </div>
              </div>

              <div className="p-3 bg-emerald-500/10 border border-emerald-500/20 rounded-xl text-xs text-emerald-600">
                ✨ Order status will be set to <strong>DISPATCHED</strong>. Profit will be realized upon successful delivery.
              </div>
            </div>
          )}

          {/* Navigation Controls */}
          <div className="pt-4 border-t border-slate-200 flex justify-between items-center">
            {step > 1 ? (
              <button
                type="button"
                onClick={() => setStep((s) => (s - 1) as any)}
                className="px-4 py-2 bg-slate-100 hover:bg-slate-200 text-slate-700 text-xs font-semibold rounded-xl flex items-center gap-1 transition"
              >
                <ArrowLeft className="h-4 w-4" /> Back
              </button>
            ) : (
              <div />
            )}

            {step < 3 ? (
              <button
                type="button"
                onClick={handleNextStep}
                className="px-5 py-2 bg-emerald-500 hover:bg-emerald-600 text-white font-bold text-xs rounded-xl flex items-center gap-1 transition shadow-md shadow-emerald-500/10"
              >
                Next <ArrowRight className="h-4 w-4" />
              </button>
            ) : (
              <button
                type="submit"
                disabled={isSubmitting}
                className="px-6 py-2 bg-emerald-500 hover:bg-emerald-600 text-white font-bold text-xs rounded-xl flex items-center gap-1.5 transition shadow-lg shadow-emerald-500/20 disabled:opacity-50"
              >
                <Check className="h-4 w-4" />
                {isSubmitting ? 'Creating...' : 'Create Dispatch'}
              </button>
            )}
          </div>
        </form>

      </div>
    </div>
  )
}
