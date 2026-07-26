'use client'

import React, { useState, useEffect } from 'react'
import { X, PlusCircle, Users, CreditCard, DollarSign } from 'lucide-react'

interface Product {
  id: string
  name: string
  costPrice: number
  salePrice: number
  stockQty: number
}

interface Partner {
  id: string
  name: string
}

interface Supplier {
  id: string
  name: string
  unpaidBalance: number
}

interface InventoryModalProps {
  isOpen: boolean
  onClose: () => void
  onSuccess: () => void
}

export default function InventoryModal({ isOpen, onClose, onSuccess }: InventoryModalProps) {
  const [products, setProducts] = useState<Product[]>([])
  const [partners, setPartners] = useState<Partner[]>([])
  const [suppliers, setSuppliers] = useState<Supplier[]>([])

  const [productId, setProductId] = useState('')
  const [quantity, setQuantity] = useState('10')
  const [unitCost, setUnitCost] = useState('')
  const [fundingSource, setFundingSource] = useState<'BUSINESS_PROFIT' | 'PERSONAL_CAPITAL' | 'CREDIT_SUPPLIER'>('BUSINESS_PROFIT')
  const [partnerId, setPartnerId] = useState('')
  const [supplierId, setSupplierId] = useState('')

  const [isSubmitting, setIsSubmitting] = useState(false)
  const [error, setError] = useState<string | null>(null)

  useEffect(() => {
    if (isOpen) {
      // Fetch Products, Partners, Suppliers
      Promise.all([
        fetch('/api/products').then((r) => r.json()),
        fetch('/api/partners').then((r) => r.json()),
        fetch('/api/suppliers').then((r) => r.json()),
      ]).then(([prods, parts, supps]) => {
        if (Array.isArray(prods)) setProducts(prods)
        if (Array.isArray(parts)) {
          setPartners(parts)
          if (parts.length > 0) setPartnerId(parts[0].id)
        }
        if (Array.isArray(supps)) {
          setSuppliers(supps)
          if (supps.length > 0) setSupplierId(supps[0].id)
        }
      }).catch(console.error)
    }
  }, [isOpen])

  const handleProductSelect = (id: string) => {
    setProductId(id)
    const p = products.find((prod) => prod.id === id)
    if (p) {
      setUnitCost(p.costPrice.toString())
    }
  }

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault()
    setError(null)
    setIsSubmitting(true)

    try {
      const res = await fetch('/api/purchases', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          productId,
          quantity,
          unitCost,
          fundingSource,
          partnerId: fundingSource === 'PERSONAL_CAPITAL' ? partnerId : null,
          supplierId: fundingSource === 'CREDIT_SUPPLIER' ? supplierId : null,
        }),
      })

      if (!res.ok) {
        const data = await res.json()
        throw new Error(data.error || 'Failed to process inventory purchase')
      }

      onSuccess()
      onClose()
      setProductId('')
      setQuantity('10')
      setUnitCost('')
    } catch (err: any) {
      setError(err.message || 'Restock failed')
    } finally {
      setIsSubmitting(false)
    }
  }

  if (!isOpen) return null

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-slate-950/80 backdrop-blur-sm animate-in fade-in">
      <div className="bg-slate-900 border border-slate-800 rounded-2xl w-full max-w-lg shadow-2xl text-slate-100 overflow-hidden">
        
        {/* Header */}
        <div className="flex items-center justify-between p-5 border-b border-slate-800">
          <div className="flex items-center gap-2">
            <div className="p-2 rounded-lg bg-emerald-500/10 text-emerald-400">
              <PlusCircle className="h-5 w-5" />
            </div>
            <div>
              <h2 className="font-bold text-lg">Restock Inventory</h2>
              <p className="text-xs text-slate-400">Buy stock & route capital or supplier credit</p>
            </div>
          </div>
          <button onClick={onClose} className="p-1 text-slate-400 hover:text-white rounded-lg">
            <X className="h-5 w-5" />
          </button>
        </div>

        {/* Form Body */}
        <form onSubmit={handleSubmit} className="p-6 space-y-4">
          {error && (
            <div className="p-3 bg-rose-500/10 border border-rose-500/30 text-rose-400 text-xs rounded-lg">
              {error}
            </div>
          )}

          {/* Select Product */}
          <div>
            <label className="block text-xs font-semibold text-slate-300 mb-1">Select Product *</label>
            <select
              required
              value={productId}
              onChange={(e) => handleProductSelect(e.target.value)}
              className="w-full bg-slate-800 border border-slate-700 rounded-lg px-3 py-2 text-sm text-slate-200 focus:outline-none focus:border-emerald-500 transition"
            >
              <option value="">-- Choose Product --</option>
              {products.map((p) => (
                <option key={p.id} value={p.id}>
                  {p.name} (Current Stock: {p.stockQty})
                </option>
              ))}
            </select>
          </div>

          {/* Quantity & Unit Cost */}
          <div className="grid grid-cols-2 gap-3">
            <div>
              <label className="block text-xs font-semibold text-slate-300 mb-1">Quantity *</label>
              <input
                type="number"
                min="1"
                required
                value={quantity}
                onChange={(e) => setQuantity(e.target.value)}
                className="w-full bg-slate-800 border border-slate-700 rounded-lg px-3 py-2 text-sm text-slate-200 focus:outline-none focus:border-emerald-500 transition"
              />
            </div>
            <div>
              <label className="block text-xs font-semibold text-slate-300 mb-1">Unit Cost Price (Rs) *</label>
              <input
                type="number"
                step="0.01"
                required
                value={unitCost}
                onChange={(e) => setUnitCost(e.target.value)}
                placeholder="1200"
                className="w-full bg-slate-800 border border-slate-700 rounded-lg px-3 py-2 text-sm text-slate-200 focus:outline-none focus:border-emerald-500 transition"
              />
            </div>
          </div>

          {/* Funding Source Selector Toggles */}
          <div>
            <label className="block text-xs font-semibold text-slate-300 mb-2">Funding Source *</label>
            <div className="grid grid-cols-3 gap-2 text-xs font-medium">
              {[
                { label: 'Business Profit', value: 'BUSINESS_PROFIT', icon: DollarSign },
                { label: 'Personal Capital', value: 'PERSONAL_CAPITAL', icon: Users },
                { label: 'Credit Supplier', value: 'CREDIT_SUPPLIER', icon: CreditCard },
              ].map((item) => {
                const Icon = item.icon
                const isSelected = fundingSource === item.value
                return (
                  <button
                    key={item.value}
                    type="button"
                    onClick={() => setFundingSource(item.value as any)}
                    className={`p-2.5 rounded-lg border text-center flex flex-col items-center gap-1.5 transition ${
                      isSelected
                        ? 'bg-emerald-500/10 border-emerald-500 text-emerald-400 font-bold'
                        : 'bg-slate-800/60 border-slate-700 text-slate-400 hover:text-slate-200'
                    }`}
                  >
                    <Icon className="h-4 w-4" />
                    <span>{item.label}</span>
                  </button>
                )
              })}
            </div>
          </div>

          {/* Conditional Partner Selector */}
          {fundingSource === 'PERSONAL_CAPITAL' && (
            <div className="p-3 bg-blue-500/10 border border-blue-500/20 rounded-xl space-y-2">
              <label className="block text-xs font-semibold text-blue-400">
                Select Partner Injection (Noman / Mujtaba)
              </label>
              <select
                value={partnerId}
                onChange={(e) => setPartnerId(e.target.value)}
                className="w-full bg-slate-900 border border-slate-700 rounded-lg px-3 py-2 text-sm text-slate-200 focus:outline-none focus:border-blue-500 transition"
              >
                {partners.map((pt) => (
                  <option key={pt.id} value={pt.id}>
                    {pt.name}
                  </option>
                ))}
              </select>
              <p className="text-[11px] text-slate-400">
                This purchase will increment Partner&apos;s total invested capital ledger.
              </p>
            </div>
          )}

          {/* Conditional Supplier Selector */}
          {fundingSource === 'CREDIT_SUPPLIER' && (
            <div className="p-3 bg-purple-500/10 border border-purple-500/20 rounded-xl space-y-2">
              <label className="block text-xs font-semibold text-purple-400">Select Credit Supplier</label>
              <select
                value={supplierId}
                onChange={(e) => setSupplierId(e.target.value)}
                className="w-full bg-slate-900 border border-slate-700 rounded-lg px-3 py-2 text-sm text-slate-200 focus:outline-none focus:border-purple-500 transition"
              >
                {suppliers.map((sup) => (
                  <option key={sup.id} value={sup.id}>
                    {sup.name} (Unpaid: Rs. {sup.unpaidBalance})
                  </option>
                ))}
              </select>
              <p className="text-[11px] text-slate-400">
                Total purchase cost will be added to Supplier Unpaid Balance.
              </p>
            </div>
          )}

          {/* Total Cost Summary */}
          <div className="bg-slate-800/80 p-3 rounded-lg flex justify-between items-center text-xs">
            <span className="text-slate-400">Total Purchase Cost:</span>
            <span className="text-base font-bold text-emerald-400">
              Rs. {((parseInt(quantity, 10) || 0) * (parseFloat(unitCost) || 0)).toLocaleString()}
            </span>
          </div>

          {/* Buttons */}
          <div className="pt-2 flex justify-end gap-3 border-t border-slate-800">
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
              {isSubmitting ? 'Processing...' : 'Confirm Restock'}
            </button>
          </div>
        </form>

      </div>
    </div>
  )
}
