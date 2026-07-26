'use client'

import React, { useState, useEffect } from 'react'
import { X, Sparkles, MapPin, Package, User, DollarSign, Truck } from 'lucide-react'

interface Product {
  id: string
  name: string
  costPrice: number
  salePrice: number
  stockQty: number
}

interface NewSaleModalProps {
  isOpen: boolean
  onClose: () => void
  onSuccess: () => void
}

export default function NewSaleModal({ isOpen, onClose, onSuccess }: NewSaleModalProps) {
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

  // Fetch available products catalog
  useEffect(() => {
    if (isOpen) {
      fetch('/api/products')
        .then((res) => res.json())
        .then((data) => {
          if (Array.isArray(data)) setProducts(data)
        })
        .catch((err) => console.error(err))
    }
  }, [isOpen])

  // Handle Product Selection change
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

  // Handle City Change & Auto Delivery Fee Lookup
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

      // Reset form
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

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-slate-950/80 backdrop-blur-sm animate-in fade-in">
      <div className="bg-slate-900 border border-slate-800 rounded-2xl w-full max-w-xl shadow-2xl text-slate-100 overflow-hidden flex flex-col max-h-[90vh]">
        
        {/* Modal Header */}
        <div className="flex items-center justify-between p-5 border-b border-slate-800 bg-slate-900/50">
          <div className="flex items-center gap-2">
            <div className="p-2 rounded-lg bg-emerald-500/10 text-emerald-400">
              <Sparkles className="h-5 w-5" />
            </div>
            <div>
              <h2 className="text-lg font-bold">New Order Dispatch</h2>
              <p className="text-xs text-slate-400">Default status: DISPATCHED (Profit realized on delivery)</p>
            </div>
          </div>
          <button
            onClick={onClose}
            className="p-1 rounded-lg text-slate-400 hover:text-white hover:bg-slate-800 transition"
          >
            <X className="h-5 w-5" />
          </button>
        </div>

        {/* Modal Form Body */}
        <form onSubmit={handleSubmit} className="p-6 overflow-y-auto space-y-4">
          {error && (
            <div className="p-3 bg-rose-500/10 border border-rose-500/30 text-rose-400 text-xs rounded-lg">
              {error}
            </div>
          )}

          {/* Product Selection Catalog Dropdown */}
          <div>
            <label className="block text-xs font-semibold text-slate-300 mb-1">
              Select Product from Catalog (Optional)
            </label>
            <select
              value={selectedProductId}
              onChange={(e) => handleProductChange(e.target.value)}
              className="w-full bg-slate-800 border border-slate-700 rounded-lg px-3 py-2 text-sm text-slate-200 focus:outline-none focus:border-emerald-500 transition"
            >
              <option value="">-- Choose existing product --</option>
              {products.map((p) => (
                <option key={p.id} value={p.id}>
                  {p.name} (Stock: {p.stockQty}) — Cost: Rs.{p.costPrice} | Sale: Rs.{p.salePrice}
                </option>
              ))}
            </select>
          </div>

          {/* Product Name Manual Override */}
          <div>
            <label className="block text-xs font-semibold text-slate-300 mb-1">Product Name *</label>
            <div className="relative">
              <Package className="absolute left-3 top-2.5 h-4 w-4 text-slate-500" />
              <input
                type="text"
                required
                value={formData.productName}
                onChange={(e) => setFormData((prev) => ({ ...prev, productName: e.target.value }))}
                placeholder="e.g. Waterproof Double Top Cover"
                className="w-full bg-slate-800 border border-slate-700 rounded-lg pl-9 pr-3 py-2 text-sm text-slate-200 focus:outline-none focus:border-emerald-500 transition"
              />
            </div>
          </div>

          {/* Customer Name & Quantity */}
          <div className="grid grid-cols-1 sm:grid-cols-3 gap-3">
            <div className="sm:col-span-2">
              <label className="block text-xs font-semibold text-slate-300 mb-1">Customer Name *</label>
              <div className="relative">
                <User className="absolute left-3 top-2.5 h-4 w-4 text-slate-500" />
                <input
                  type="text"
                  required
                  value={formData.customerName}
                  onChange={(e) => setFormData((prev) => ({ ...prev, customerName: e.target.value }))}
                  placeholder="Customer Full Name"
                  className="w-full bg-slate-800 border border-slate-700 rounded-lg pl-9 pr-3 py-2 text-sm text-slate-200 focus:outline-none focus:border-emerald-500 transition"
                />
              </div>
            </div>

            <div>
              <label className="block text-xs font-semibold text-slate-300 mb-1">Quantity</label>
              <input
                type="number"
                min="1"
                required
                value={formData.quantity}
                onChange={(e) => setFormData((prev) => ({ ...prev, quantity: e.target.value }))}
                className="w-full bg-slate-800 border border-slate-700 rounded-lg px-3 py-2 text-sm text-slate-200 focus:outline-none focus:border-emerald-500 transition"
              />
            </div>
          </div>

          {/* City & Address with Auto-City Lookup */}
          <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
            <div>
              <label className="block text-xs font-semibold text-slate-300 mb-1">
                City * {isLoadingCityFee && <span className="text-[10px] text-emerald-400 animate-pulse">(fetching fee...)</span>}
              </label>
              <div className="relative">
                <MapPin className="absolute left-3 top-2.5 h-4 w-4 text-slate-500" />
                <input
                  type="text"
                  required
                  value={formData.city}
                  onChange={(e) => handleCityChange(e.target.value)}
                  placeholder="e.g. Lahore, Karachi, Islamabad"
                  className="w-full bg-slate-800 border border-slate-700 rounded-lg pl-9 pr-3 py-2 text-sm text-slate-200 focus:outline-none focus:border-emerald-500 transition"
                />
              </div>
            </div>

            <div>
              <label className="block text-xs font-semibold text-slate-300 mb-1">Full Address *</label>
              <input
                type="text"
                required
                value={formData.address}
                onChange={(e) => setFormData((prev) => ({ ...prev, address: e.target.value }))}
                placeholder="House #, Street, Area"
                className="w-full bg-slate-800 border border-slate-700 rounded-lg px-3 py-2 text-sm text-slate-200 focus:outline-none focus:border-emerald-500 transition"
              />
            </div>
          </div>

          {/* Cost Price, Sold Price, Delivery Charge */}
          <div className="grid grid-cols-1 sm:grid-cols-3 gap-3">
            <div>
              <label className="block text-xs font-semibold text-slate-300 mb-1">Unit Cost Price (Rs) *</label>
              <div className="relative">
                <DollarSign className="absolute left-3 top-2.5 h-4 w-4 text-slate-500" />
                <input
                  type="number"
                  step="0.01"
                  required
                  value={formData.costPrice}
                  onChange={(e) => setFormData((prev) => ({ ...prev, costPrice: e.target.value }))}
                  placeholder="1200"
                  className="w-full bg-slate-800 border border-slate-700 rounded-lg pl-9 pr-3 py-2 text-sm text-slate-200 focus:outline-none focus:border-emerald-500 transition"
                />
              </div>
            </div>

            <div>
              <label className="block text-xs font-semibold text-slate-300 mb-1">Unit Sold Price (Rs) *</label>
              <div className="relative">
                <DollarSign className="absolute left-3 top-2.5 h-4 w-4 text-slate-500" />
                <input
                  type="number"
                  step="0.01"
                  required
                  value={formData.soldPrice}
                  onChange={(e) => setFormData((prev) => ({ ...prev, soldPrice: e.target.value }))}
                  placeholder="2200"
                  className="w-full bg-slate-800 border border-slate-700 rounded-lg pl-9 pr-3 py-2 text-sm text-slate-200 focus:outline-none focus:border-emerald-500 transition"
                />
              </div>
            </div>

            <div>
              <label className="block text-xs font-semibold text-slate-300 mb-1">Delivery Fee (Rs)</label>
              <div className="relative">
                <Truck className="absolute left-3 top-2.5 h-4 w-4 text-slate-500" />
                <input
                  type="number"
                  step="0.01"
                  value={formData.deliveryCharge}
                  onChange={(e) => setFormData((prev) => ({ ...prev, deliveryCharge: e.target.value }))}
                  placeholder="250"
                  className="w-full bg-slate-800 border border-slate-700 rounded-lg pl-9 pr-3 py-2 text-sm text-slate-200 focus:outline-none focus:border-emerald-500 transition"
                />
              </div>
            </div>
          </div>

          {/* Action Buttons */}
          <div className="pt-4 border-t border-slate-800 flex justify-end gap-3">
            <button
              type="button"
              onClick={onClose}
              className="px-4 py-2 rounded-lg bg-slate-800 hover:bg-slate-700 text-slate-300 text-sm font-medium transition"
            >
              Cancel
            </button>
            <button
              type="submit"
              disabled={isSubmitting}
              className="px-5 py-2 rounded-lg bg-emerald-500 hover:bg-emerald-600 text-slate-950 font-bold text-sm transition shadow-lg shadow-emerald-500/20 disabled:opacity-50"
            >
              {isSubmitting ? 'Dispatching...' : 'Dispatch Order'}
            </button>
          </div>
        </form>

      </div>
    </div>
  )
}
