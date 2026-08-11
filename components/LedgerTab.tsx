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
      
      {/* 1. Partner Investment Section */}
      <div className="bg-slate-900 border border-slate-800 rounded-2xl p-6 shadow-xl space-y-4">
        <div className="flex items-center justify-between">
          <div>
            <h3 className="text-base font-bold text-slate-100 flex items-center gap-2">
              <Users className="h-5 w-5 text-blue-400" />
              Partner Investment
            </h3>
            <p className="text-xs text-slate-400">Total capital invested into inventory & business operations</p>
          </div>
          <button
            onClick={() => setShowAddPartner(true)}
            className="px-3.5 py-1.5 bg-slate-800 hover:bg-slate-700 text-slate-200 text-xs font-semibold rounded-xl border border-slate-700 transition"
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
                className="bg-slate-800/60 border border-slate-700/60 rounded-xl p-5 shadow-lg space-y-3"
              >
                <div className="flex justify-between items-start">
                  <div>
                    <span className="text-[11px] font-semibold text-slate-400 uppercase tracking-wider">Partner Investor</span>
                    <h4 className="text-lg font-bold text-slate-100 mt-0.5">{p.name}</h4>
                  </div>
                  <div className="h-8 w-8 rounded-lg bg-blue-500/10 text-blue-400 flex items-center justify-center">
                    <ArrowUpRight className="h-4 w-4" />
                  </div>
                </div>
                <div className="pt-3 border-t border-slate-700/50 flex justify-between items-center">
                  <span className="text-xs text-slate-400">Total Invested:</span>
                  <span className="text-base font-mono font-bold text-blue-400">
                    Rs. {p.totalCapitalInvested.toLocaleString()}
                  </span>
                </div>
              </div>
            ))}
          </div>
        )}
      </div>

      {/* 2. Supplier Payables Section */}
      <div className="bg-slate-900 border border-slate-800 rounded-2xl p-6 shadow-xl space-y-4">
        <div className="flex items-center justify-between">
          <div>
            <h3 className="text-base font-bold text-slate-100 flex items-center gap-2">
              <CreditCard className="h-5 w-5 text-purple-400" />
              Supplier Payables
            </h3>
            <p className="text-xs text-slate-400">Outstanding balances owed to credit suppliers</p>
          </div>
          <button
            onClick={() => setShowAddSupplier(true)}
            className="px-3.5 py-1.5 bg-slate-800 hover:bg-slate-700 text-slate-200 text-xs font-semibold rounded-xl border border-slate-700 transition"
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
                    Credit Supplier
                  </span>
                </div>
                <div className="pt-2 border-t border-slate-700/50 flex justify-between items-center">
                  <span className="text-xs text-slate-400">Outstanding Balance:</span>
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
        <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-slate-950/80 backdrop-blur-sm animate-in fade-in">
          <div className="bg-slate-900 border border-slate-800 rounded-2xl p-6 w-full max-w-sm text-slate-100 space-y-4">
            <h3 className="font-bold text-base">Add Partner</h3>
            <form onSubmit={handleAddPartner} className="space-y-3">
              <input
                type="text"
                required
                value={partnerName}
                onChange={(e) => setPartnerName(e.target.value)}
                placeholder="Partner Name"
                className="w-full bg-slate-800 border border-slate-700 rounded-xl px-3 py-2 text-sm text-slate-200 focus:outline-none focus:border-blue-500"
              />
              <div className="flex justify-end gap-2 pt-2">
                <button
                  type="button"
                  onClick={() => setShowAddPartner(false)}
                  className="px-3 py-1.5 bg-slate-800 text-slate-300 text-xs rounded-xl"
                >
                  Cancel
                </button>
                <button type="submit" className="px-4 py-1.5 bg-blue-500 text-white font-bold text-xs rounded-xl">
                  Save Partner
                </button>
              </div>
            </form>
          </div>
        </div>
      )}

      {/* Add Supplier Modal */}
      {showAddSupplier && (
        <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-slate-950/80 backdrop-blur-sm animate-in fade-in">
          <div className="bg-slate-900 border border-slate-800 rounded-2xl p-6 w-full max-w-sm text-slate-100 space-y-4">
            <h3 className="font-bold text-base">Add Credit Supplier</h3>
            <form onSubmit={handleAddSupplier} className="space-y-3">
              <input
                type="text"
                required
                value={supplierName}
                onChange={(e) => setSupplierName(e.target.value)}
                placeholder="Supplier Company Name"
                className="w-full bg-slate-800 border border-slate-700 rounded-xl px-3 py-2 text-sm text-slate-200 focus:outline-none focus:border-purple-500"
              />
              <input
                type="text"
                value={supplierPhone}
                onChange={(e) => setSupplierPhone(e.target.value)}
                placeholder="Phone Number (Optional)"
                className="w-full bg-slate-800 border border-slate-700 rounded-xl px-3 py-2 text-sm text-slate-200 focus:outline-none focus:border-purple-500"
              />
              <div className="flex justify-end gap-2 pt-2">
                <button
                  type="button"
                  onClick={() => setShowAddSupplier(false)}
                  className="px-3 py-1.5 bg-slate-800 text-slate-300 text-xs rounded-xl"
                >
                  Cancel
                </button>
                <button type="submit" className="px-4 py-1.5 bg-purple-500 text-white font-bold text-xs rounded-xl">
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
