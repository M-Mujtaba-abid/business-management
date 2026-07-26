'use client'

import React, { useState, useEffect } from 'react'
import { Users, CreditCard, ArrowUpRight } from 'lucide-react'

interface Partner {
  id: string
  name: string
  totalCapitalInvested: number
}

interface Supplier {
  id: string
  name: string
  phone?: string
  unpaidBalance: number
}

export default function LedgerTab() {
  const [partners, setPartners] = useState<Partner[]>([])
  const [suppliers, setSuppliers] = useState<Supplier[]>([])
  const [isLoading, setIsLoading] = useState(true)

  const [showAddPartner, setShowAddPartner] = useState(false)
  const [partnerName, setPartnerName] = useState('')

  const [showAddSupplier, setShowAddSupplier] = useState(false)
  const [supplierName, setSupplierName] = useState('')
  const [supplierPhone, setSupplierPhone] = useState('')

  const fetchData = () => {
    setIsLoading(true)
    Promise.all([
      fetch('/api/partners').then((r) => r.json()),
      fetch('/api/suppliers').then((r) => r.json()),
    ])
      .then(([parts, supps]) => {
        if (Array.isArray(parts)) setPartners(parts)
        if (Array.isArray(supps)) setSuppliers(supps)
      })
      .finally(() => setIsLoading(false))
  }

  useEffect(() => {
    fetchData()
  }, [])

  const handleAddPartner = async (e: React.FormEvent) => {
    e.preventDefault()
    if (!partnerName) return
    const res = await fetch('/api/partners', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ name: partnerName }),
    })
    if (res.ok) {
      fetchData()
      setPartnerName('')
      setShowAddPartner(false)
    }
  }

  const handleAddSupplier = async (e: React.FormEvent) => {
    e.preventDefault()
    if (!supplierName) return
    const res = await fetch('/api/suppliers', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ name: supplierName, phone: supplierPhone }),
    })
    if (res.ok) {
      fetchData()
      setSupplierName('')
      setSupplierPhone('')
      setShowAddSupplier(false)
    }
  }

  return (
    <div className="space-y-6">
      
      {/* 1. Partner Capital Equity Section */}
      <div className="bg-slate-900 border border-slate-800 rounded-2xl p-6 shadow-xl space-y-4">
        <div className="flex items-center justify-between">
          <div>
            <h3 className="text-lg font-bold text-slate-100 flex items-center gap-2">
              <Users className="h-5 w-5 text-blue-400" />
              Partner Capital Equity (Noman & Mujtaba)
            </h3>
            <p className="text-xs text-slate-400">Total personal capital injected into inventory & expenses</p>
          </div>
          <button
            onClick={() => setShowAddPartner(true)}
            className="px-3.5 py-1.5 bg-slate-800 hover:bg-slate-700 text-slate-200 text-xs font-semibold rounded-lg border border-slate-700 transition"
          >
            + Add Partner
          </button>
        </div>

        {isLoading ? (
          <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-4">
            {[...Array(2)].map((_, i) => (
              <div key={i} className="h-28 bg-slate-800/40 rounded-xl animate-pulse" />
            ))}
          </div>
        ) : (
          <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-4">
            {partners.map((p) => (
              <div
                key={p.id}
                className="bg-gradient-to-br from-slate-800/80 to-slate-900 border border-slate-700/60 rounded-xl p-5 shadow-lg"
              >
                <div className="flex justify-between items-start">
                  <div>
                    <span className="text-xs font-semibold text-slate-400 uppercase tracking-wider">Partner</span>
                    <h4 className="text-xl font-bold text-slate-100 mt-0.5">{p.name}</h4>
                  </div>
                  <div className="h-8 w-8 rounded-lg bg-blue-500/10 text-blue-400 flex items-center justify-center">
                    <ArrowUpRight className="h-4 w-4" />
                  </div>
                </div>
                <div className="mt-4 pt-3 border-t border-slate-700/50 flex justify-between items-center">
                  <span className="text-xs text-slate-400">Total Invested:</span>
                  <span className="text-lg font-mono font-bold text-blue-400">
                    Rs. {p.totalCapitalInvested.toLocaleString()}
                  </span>
                </div>
              </div>
            ))}
          </div>
        )}
      </div>

      {/* 2. Supplier Debt Ledger Section */}
      <div className="bg-slate-900 border border-slate-800 rounded-2xl p-6 shadow-xl space-y-4">
        <div className="flex items-center justify-between">
          <div>
            <h3 className="text-lg font-bold text-slate-100 flex items-center gap-2">
              <CreditCard className="h-5 w-5 text-purple-400" />
              Credit Supplier Debt Ledger
            </h3>
            <p className="text-xs text-slate-400">Unpaid balances owed to raw material & product suppliers</p>
          </div>
          <button
            onClick={() => setShowAddSupplier(true)}
            className="px-3.5 py-1.5 bg-slate-800 hover:bg-slate-700 text-slate-200 text-xs font-semibold rounded-lg border border-slate-700 transition"
          >
            + Add Supplier
          </button>
        </div>

        {suppliers.length === 0 ? (
          <div className="p-8 text-center border border-dashed border-slate-800 rounded-xl text-slate-500 text-xs">
            No credit suppliers recorded.
          </div>
        ) : (
          <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-4">
            {suppliers.map((s) => (
              <div
                key={s.id}
                className="bg-slate-800/60 border border-slate-700/60 rounded-xl p-5 shadow-lg space-y-3"
              >
                <div className="flex justify-between items-start">
                  <div>
                    <h4 className="text-base font-bold text-slate-100">{s.name}</h4>
                    {s.phone && <p className="text-xs text-slate-400">{s.phone}</p>}
                  </div>
                  <span className="text-[11px] px-2 py-0.5 rounded-full bg-purple-500/10 text-purple-400 border border-purple-500/20 font-semibold">
                    Supplier
                  </span>
                </div>
                <div className="pt-2 border-t border-slate-700/50 flex justify-between items-center">
                  <span className="text-xs text-slate-400">Unpaid Balance:</span>
                  <span className="text-base font-mono font-bold text-purple-400">
                    Rs. {s.unpaidBalance.toLocaleString()}
                  </span>
                </div>
              </div>
            ))}
          </div>
        )}
      </div>

      {/* Add Partner Modal */}
      {showAddPartner && (
        <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-slate-950/80 backdrop-blur-sm">
          <div className="bg-slate-900 border border-slate-800 rounded-2xl p-6 w-full max-w-sm text-slate-100 space-y-4">
            <h3 className="font-bold text-lg">Add Partner</h3>
            <form onSubmit={handleAddPartner} className="space-y-3">
              <input
                type="text"
                required
                value={partnerName}
                onChange={(e) => setPartnerName(e.target.value)}
                placeholder="Partner Name (e.g. Noman)"
                className="w-full bg-slate-800 border border-slate-700 rounded-lg px-3 py-2 text-sm text-slate-200"
              />
              <div className="flex justify-end gap-2">
                <button
                  type="button"
                  onClick={() => setShowAddPartner(false)}
                  className="px-3 py-1.5 bg-slate-800 text-slate-300 text-xs rounded-lg"
                >
                  Cancel
                </button>
                <button type="submit" className="px-4 py-1.5 bg-blue-500 text-white font-bold text-xs rounded-lg">
                  Save Partner
                </button>
              </div>
            </form>
          </div>
        </div>
      )}

      {/* Add Supplier Modal */}
      {showAddSupplier && (
        <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-slate-950/80 backdrop-blur-sm">
          <div className="bg-slate-900 border border-slate-800 rounded-2xl p-6 w-full max-w-sm text-slate-100 space-y-4">
            <h3 className="font-bold text-lg">Add Credit Supplier</h3>
            <form onSubmit={handleAddSupplier} className="space-y-3">
              <input
                type="text"
                required
                value={supplierName}
                onChange={(e) => setSupplierName(e.target.value)}
                placeholder="Supplier Name (e.g. Apex Textiles)"
                className="w-full bg-slate-800 border border-slate-700 rounded-lg px-3 py-2 text-sm text-slate-200"
              />
              <input
                type="text"
                value={supplierPhone}
                onChange={(e) => setSupplierPhone(e.target.value)}
                placeholder="Phone Number (Optional)"
                className="w-full bg-slate-800 border border-slate-700 rounded-lg px-3 py-2 text-sm text-slate-200"
              />
              <div className="flex justify-end gap-2">
                <button
                  type="button"
                  onClick={() => setShowAddSupplier(false)}
                  className="px-3 py-1.5 bg-slate-800 text-slate-300 text-xs rounded-lg"
                >
                  Cancel
                </button>
                <button type="submit" className="px-4 py-1.5 bg-purple-500 text-white font-bold text-xs rounded-lg">
                  Save Supplier
                </button>
              </div>
            </form>
          </div>
        </div>
      )}

    </div>
  )
}
