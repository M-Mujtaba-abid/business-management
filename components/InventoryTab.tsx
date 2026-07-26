'use client'

import React, { useState, useEffect } from 'react'
import { Package, AlertTriangle, CheckCircle2, XCircle } from 'lucide-react'

interface Product {
  id: string
  name: string
  costPrice: number
  salePrice: number
  stockQty: number
  updatedAt: string
}

interface InventoryTabProps {
  onOpenRestock: () => void
}

export default function InventoryTab({ onOpenRestock }: InventoryTabProps) {
  const [products, setProducts] = useState<Product[]>([])
  const [isLoading, setIsLoading] = useState(true)
  const [showAddModal, setShowAddModal] = useState(false)

  const [newProdName, setNewProdName] = useState('')
  const [newCostPrice, setNewCostPrice] = useState('')
  const [newSalePrice, setNewSalePrice] = useState('')
  const [newStockQty, setNewStockQty] = useState('0')
  const [isSubmitting, setIsSubmitting] = useState(false)

  const fetchProducts = () => {
    setIsLoading(true)
    fetch('/api/products')
      .then((r) => r.json())
      .then((data) => {
        if (Array.isArray(data)) setProducts(data)
      })
      .finally(() => setIsLoading(false))
  }

  useEffect(() => {
    fetchProducts()
  }, [])

  const handleCreateProduct = async (e: React.FormEvent) => {
    e.preventDefault()
    setIsSubmitting(true)
    try {
      const res = await fetch('/api/products', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          name: newProdName,
          costPrice: newCostPrice,
          salePrice: newSalePrice,
          stockQty: newStockQty,
        }),
      })
      if (res.ok) {
        fetchProducts()
        setShowAddModal(false)
        setNewProdName('')
        setNewCostPrice('')
        setNewSalePrice('')
        setNewStockQty('0')
      }
    } catch (err) {
      console.error(err)
    } finally {
      setIsSubmitting(false)
    }
  }

  const getStockBadge = (qty: number) => {
    if (qty >= 5) {
      return (
        <span className="inline-flex items-center gap-1 px-2.5 py-0.5 rounded-full text-xs font-semibold bg-emerald-500/10 text-emerald-400 border border-emerald-500/20">
          <CheckCircle2 className="h-3 w-3" /> In Stock ({qty})
        </span>
      )
    } else if (qty > 0) {
      return (
        <span className="inline-flex items-center gap-1 px-2.5 py-0.5 rounded-full text-xs font-semibold bg-amber-500/10 text-amber-400 border border-amber-500/20">
          <AlertTriangle className="h-3 w-3" /> Low Stock ({qty})
        </span>
      )
    } else {
      return (
        <span className="inline-flex items-center gap-1 px-2.5 py-0.5 rounded-full text-xs font-semibold bg-rose-500/10 text-rose-400 border border-rose-500/20">
          <XCircle className="h-3 w-3" /> Out of Stock (0)
        </span>
      )
    }
  }

  return (
    <div className="space-y-6">
      
      {/* Header Bar */}
      <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4 bg-slate-900 border border-slate-800 p-5 rounded-2xl">
        <div>
          <h2 className="text-lg font-bold text-slate-100 flex items-center gap-2">
            <Package className="h-5 w-5 text-emerald-400" />
            Inventory & Stock Catalog
          </h2>
          <p className="text-xs text-slate-400">Track current stock levels, cost prices, and margins</p>
        </div>
        <div className="flex items-center gap-2">
          <button
            onClick={() => setShowAddModal(true)}
            className="px-3.5 py-2 bg-slate-800 hover:bg-slate-700 text-slate-200 border border-slate-700 text-xs font-medium rounded-lg transition"
          >
            + Create New Product
          </button>
          <button
            onClick={onOpenRestock}
            className="px-4 py-2 bg-emerald-500 hover:bg-emerald-600 text-slate-950 font-bold text-xs rounded-lg transition shadow-md shadow-emerald-500/10"
          >
            + Buy Inventory / Restock
          </button>
        </div>
      </div>

      {/* Catalog Table */}
      <div className="bg-slate-900 border border-slate-800 rounded-2xl p-6 shadow-xl">
        {isLoading ? (
          <div className="space-y-3">
            {[...Array(4)].map((_, i) => (
              <div key={i} className="h-14 bg-slate-800/40 rounded-xl animate-pulse" />
            ))}
          </div>
        ) : products.length === 0 ? (
          <div className="p-12 text-center border border-dashed border-slate-800 rounded-xl">
            <Package className="h-10 w-10 text-slate-600 mx-auto mb-2" />
            <p className="text-slate-400 text-sm font-medium">No products in catalog</p>
            <p className="text-slate-500 text-xs mt-1">Add products to track inventory and auto-populate pricing.</p>
          </div>
        ) : (
          <div className="overflow-x-auto">
            <table className="w-full text-left text-xs text-slate-300">
              <thead className="bg-slate-950/60 text-slate-400 uppercase tracking-wider font-semibold border-b border-slate-800">
                <tr>
                  <th className="px-4 py-3">Product Name</th>
                  <th className="px-4 py-3">Unit Cost Price</th>
                  <th className="px-4 py-3">Unit Sale Price</th>
                  <th className="px-4 py-3">Gross Margin / Unit</th>
                  <th className="px-4 py-3">Stock Status</th>
                  <th className="px-4 py-3 text-right">Actions</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-slate-800/60">
                {products.map((p) => {
                  const margin = p.salePrice - p.costPrice
                  return (
                    <tr key={p.id} className="hover:bg-slate-800/40 transition">
                      <td className="px-4 py-3.5 font-bold text-slate-100">{p.name}</td>
                      <td className="px-4 py-3.5 font-mono text-slate-300">Rs. {p.costPrice.toLocaleString()}</td>
                      <td className="px-4 py-3.5 font-mono text-emerald-400 font-semibold">Rs. {p.salePrice.toLocaleString()}</td>
                      <td className="px-4 py-3.5 font-mono font-bold text-teal-400">
                        +Rs. {margin.toLocaleString()} ({((margin / (p.costPrice || 1)) * 100).toFixed(0)}%)
                      </td>
                      <td className="px-4 py-3.5">{getStockBadge(p.stockQty)}</td>
                      <td className="px-4 py-3.5 text-right">
                        <button
                          onClick={onOpenRestock}
                          className="px-2.5 py-1 bg-emerald-500/10 hover:bg-emerald-500/20 text-emerald-400 rounded-md font-semibold text-[11px] border border-emerald-500/20 transition"
                        >
                          Restock
                        </button>
                      </td>
                    </tr>
                  )
                })}
              </tbody>
            </table>
          </div>
        )}
      </div>

      {/* Modal to Add New Product */}
      {showAddModal && (
        <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-slate-950/80 backdrop-blur-sm">
          <div className="bg-slate-900 border border-slate-800 rounded-2xl w-full max-w-md p-6 shadow-2xl space-y-4 text-slate-100">
            <h3 className="font-bold text-lg">Create New Catalog Product</h3>
            <form onSubmit={handleCreateProduct} className="space-y-3">
              <div>
                <label className="block text-xs font-semibold text-slate-300 mb-1">Product Name *</label>
                <input
                  type="text"
                  required
                  value={newProdName}
                  onChange={(e) => setNewProdName(e.target.value)}
                  placeholder="e.g. Waterproof Bike Cover"
                  className="w-full bg-slate-800 border border-slate-700 rounded-lg px-3 py-2 text-sm text-slate-200 focus:outline-none focus:border-emerald-500"
                />
              </div>

              <div className="grid grid-cols-2 gap-3">
                <div>
                  <label className="block text-xs font-semibold text-slate-300 mb-1">Cost Price (Rs) *</label>
                  <input
                    type="number"
                    step="0.01"
                    required
                    value={newCostPrice}
                    onChange={(e) => setNewCostPrice(e.target.value)}
                    placeholder="1200"
                    className="w-full bg-slate-800 border border-slate-700 rounded-lg px-3 py-2 text-sm text-slate-200 focus:outline-none focus:border-emerald-500"
                  />
                </div>
                <div>
                  <label className="block text-xs font-semibold text-slate-300 mb-1">Sale Price (Rs) *</label>
                  <input
                    type="number"
                    step="0.01"
                    required
                    value={newSalePrice}
                    onChange={(e) => setNewSalePrice(e.target.value)}
                    placeholder="2200"
                    className="w-full bg-slate-800 border border-slate-700 rounded-lg px-3 py-2 text-sm text-slate-200 focus:outline-none focus:border-emerald-500"
                  />
                </div>
              </div>

              <div>
                <label className="block text-xs font-semibold text-slate-300 mb-1">Initial Stock Qty</label>
                <input
                  type="number"
                  value={newStockQty}
                  onChange={(e) => setNewStockQty(e.target.value)}
                  className="w-full bg-slate-800 border border-slate-700 rounded-lg px-3 py-2 text-sm text-slate-200 focus:outline-none focus:border-emerald-500"
                />
              </div>

              <div className="pt-2 flex justify-end gap-2">
                <button
                  type="button"
                  onClick={() => setShowAddModal(false)}
                  className="px-4 py-2 bg-slate-800 text-slate-300 rounded-lg text-xs"
                >
                  Cancel
                </button>
                <button
                  type="submit"
                  disabled={isSubmitting}
                  className="px-4 py-2 bg-emerald-500 text-slate-950 font-bold rounded-lg text-xs"
                >
                  Save Product
                </button>
              </div>
            </form>
          </div>
        </div>
      )}

    </div>
  )
}
