'use client'

import React, { useState, useEffect } from 'react'
import { Receipt, Users } from 'lucide-react'

interface Expense {
  id: string
  title: string
  amount: number
  category: string
  fundingSource: string
  note?: string
  createdAt: string
  partner?: {
    name: string
  }
}

interface ExpensesTabProps {
  onOpenExpenseModal: () => void
}

export default function ExpensesTab({ onOpenExpenseModal }: ExpensesTabProps) {
  const [expenses, setExpenses] = useState<Expense[]>([])
  const [isLoading, setIsLoading] = useState(true)
  const [categoryFilter, setCategoryFilter] = useState('ALL')

  const fetchExpenses = () => {
    setIsLoading(true)
    let url = '/api/expenses'
    if (categoryFilter !== 'ALL') {
      url += `?category=${categoryFilter}`
    }
    fetch(url)
      .then((r) => r.json())
      .then((data) => {
        if (Array.isArray(data)) setExpenses(data)
      })
      .finally(() => setIsLoading(false))
  }

  useEffect(() => {
    fetchExpenses()
  }, [categoryFilter])

  const getCategoryBadge = (cat: string) => {
    const categories: Record<string, { label: string; color: string }> = {
      MARKETING_ADS: { label: 'Marketing & Ads', color: 'bg-purple-500/10 text-purple-400 border-purple-500/20' },
      PACKAGING: { label: 'Packaging', color: 'bg-amber-500/10 text-amber-400 border-amber-500/20' },
      COURIER_BILL: { label: 'Courier Bill', color: 'bg-rose-500/10 text-rose-400 border-rose-500/20' },
      LOGISTICS: { label: 'Logistics', color: 'bg-blue-500/10 text-blue-400 border-blue-500/20' },
      UTILITIES: { label: 'Utilities', color: 'bg-teal-500/10 text-teal-400 border-teal-500/20' },
      MISC: { label: 'Misc', color: 'bg-slate-800 text-slate-400 border-slate-700' },
    }

    const item = categories[cat] || categories.MISC
    return (
      <span className={`inline-flex items-center px-2.5 py-0.5 rounded-full text-xs font-semibold border ${item.color}`}>
        {item.label}
      </span>
    )
  }

  return (
    <div className="space-y-6">
      
      {/* Header Bar */}
      <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4 bg-slate-900 border border-slate-800 p-5 rounded-2xl">
        <div>
          <h2 className="text-lg font-bold text-slate-100 flex items-center gap-2">
            <Receipt className="h-5 w-5 text-rose-400" />
            General Expenses Portal
          </h2>
          <p className="text-xs text-slate-400">Log & filter marketing ads, packaging, courier bills, and operational expenses</p>
        </div>
        <button
          onClick={onOpenExpenseModal}
          className="px-4 py-2 bg-rose-500 hover:bg-rose-600 text-white font-bold text-xs rounded-lg transition shadow-md shadow-rose-500/10"
        >
          + Log New Expense
        </button>
      </div>

      {/* Expense History Table */}
      <div className="bg-slate-900 border border-slate-800 rounded-2xl p-6 shadow-xl space-y-4">
        
        {/* Category Filter Pills */}
        <div className="flex items-center gap-1.5 overflow-x-auto pb-2">
          {[
            { label: 'All Categories', value: 'ALL' },
            { label: 'Marketing & Ads', value: 'MARKETING_ADS' },
            { label: 'Packaging', value: 'PACKAGING' },
            { label: 'Courier Bills', value: 'COURIER_BILL' },
            { label: 'Logistics', value: 'LOGISTICS' },
            { label: 'Utilities', value: 'UTILITIES' },
            { label: 'Misc', value: 'MISC' },
          ].map((cat) => (
            <button
              key={cat.value}
              onClick={() => setCategoryFilter(cat.value)}
              className={`px-3 py-1.5 rounded-lg text-xs font-medium whitespace-nowrap transition ${
                categoryFilter === cat.value
                  ? 'bg-rose-500 text-white font-bold shadow-md shadow-rose-500/10'
                  : 'bg-slate-800/80 text-slate-400 hover:text-slate-200'
              }`}
            >
              {cat.label}
            </button>
          ))}
        </div>

        {isLoading ? (
          <div className="space-y-3">
            {[...Array(4)].map((_, i) => (
              <div key={i} className="h-14 bg-slate-800/40 rounded-xl animate-pulse" />
            ))}
          </div>
        ) : expenses.length === 0 ? (
          <div className="p-12 text-center border border-dashed border-slate-800 rounded-xl">
            <Receipt className="h-10 w-10 text-slate-600 mx-auto mb-2" />
            <p className="text-slate-400 text-sm font-medium">No expenses recorded</p>
            <p className="text-slate-500 text-xs mt-1">Log expenses to calculate accurate True Net Profit.</p>
          </div>
        ) : (
          <div className="overflow-x-auto">
            <table className="w-full text-left text-xs text-slate-300">
              <thead className="bg-slate-950/60 text-slate-400 uppercase tracking-wider font-semibold border-b border-slate-800">
                <tr>
                  <th className="px-4 py-3">Date</th>
                  <th className="px-4 py-3">Title / Description</th>
                  <th className="px-4 py-3">Category</th>
                  <th className="px-4 py-3">Funding Source</th>
                  <th className="px-4 py-3">Amount</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-slate-800/60">
                {expenses.map((exp) => (
                  <tr key={exp.id} className="hover:bg-slate-800/40 transition">
                    <td className="px-4 py-3.5 text-slate-400 font-mono">
                      {new Date(exp.createdAt).toLocaleDateString()}
                    </td>
                    <td className="px-4 py-3.5 font-semibold text-slate-100">
                      {exp.title}
                      {exp.note && <span className="block text-[11px] font-normal text-slate-500 mt-0.5">{exp.note}</span>}
                    </td>
                    <td className="px-4 py-3.5">{getCategoryBadge(exp.category)}</td>
                    <td className="px-4 py-3.5">
                      {exp.fundingSource === 'PERSONAL_CAPITAL' ? (
                        <span className="text-blue-400 font-semibold flex items-center gap-1">
                          <Users className="h-3 w-3" /> {exp.partner?.name || 'Partner'} Capital
                        </span>
                      ) : (
                        <span className="text-slate-400">Business Profit</span>
                      )}
                    </td>
                    <td className="px-4 py-3.5 font-mono font-bold text-rose-400 text-sm">
                      Rs. {exp.amount.toLocaleString()}
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        )}
      </div>

    </div>
  )
}
