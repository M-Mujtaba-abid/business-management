'use client'

import React, { useState, useEffect } from 'react'
import { Receipt } from 'lucide-react' // Users: PARTNERS LEDGER

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
      MARKETING_ADS: { label: 'Marketing & Ads', color: 'bg-purple-500/10 text-purple-600 border-purple-500/20' },
      PACKAGING: { label: 'Packaging', color: 'bg-amber-500/10 text-amber-600 border-amber-500/20' },
      COURIER_BILL: { label: 'Courier Bill', color: 'bg-rose-500/10 text-rose-600 border-rose-500/20' },
      LOGISTICS: { label: 'Logistics', color: 'bg-blue-500/10 text-blue-600 border-blue-500/20' },
      UTILITIES: { label: 'Utilities', color: 'bg-teal-500/10 text-teal-600 border-teal-500/20' },
      MISC: { label: 'Misc', color: 'bg-slate-100 text-slate-500 border-slate-300' },
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
      <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4 bg-white border border-slate-200 p-5 rounded-2xl">
        <div>
          <h2 className="text-lg font-bold text-slate-900 flex items-center gap-2">
            <Receipt className="h-5 w-5 text-rose-600" />
            Expenses
          </h2>
          <p className="text-xs text-slate-500">Ads, packaging, bills and other business costs</p>
        </div>
        <button
          onClick={onOpenExpenseModal}
          className="px-4 py-2 bg-rose-500 hover:bg-rose-600 text-white font-bold text-xs rounded-lg transition shadow-md shadow-rose-500/10"
        >
          + Add Expense
        </button>
      </div>

      {/* Expense History Table */}
      <div className="bg-white border border-slate-200 rounded-2xl p-6 shadow-sm space-y-4">
        
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
                  : 'bg-slate-100/80 text-slate-500 hover:text-slate-800'
              }`}
            >
              {cat.label}
            </button>
          ))}
        </div>

        {isLoading ? (
          <div className="space-y-3">
            {[...Array(4)].map((_, i) => (
              <div key={i} className="h-14 bg-slate-100/40 rounded-xl animate-pulse" />
            ))}
          </div>
        ) : expenses.length === 0 ? (
          <div className="p-12 text-center border border-dashed border-slate-200 rounded-xl">
            <Receipt className="h-10 w-10 text-slate-400 mx-auto mb-2" />
            <p className="text-slate-500 text-sm font-medium">No expenses recorded</p>
            <p className="text-slate-500 text-xs mt-1">Add expenses to see your real net profit.</p>
          </div>
        ) : (
          <div className="overflow-x-auto">
            <table className="w-full text-left text-xs text-slate-700">
              <thead className="bg-slate-50/60 text-slate-500 uppercase tracking-wider font-semibold border-b border-slate-200">
                <tr>
                  <th className="px-4 py-3">Date</th>
                  <th className="px-4 py-3">Title / Description</th>
                  <th className="px-4 py-3">Category</th>
                  {/* <th className="px-4 py-3">Funding Source</th> PARTNERS LEDGER */}
                  <th className="px-4 py-3">Amount</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-slate-100/60">
                {expenses.map((exp) => (
                  <tr key={exp.id} className="hover:bg-slate-100/40 transition">
                    <td className="px-4 py-3.5 text-slate-500 font-mono">
                      {new Date(exp.createdAt).toLocaleDateString()}
                    </td>
                    <td className="px-4 py-3.5 font-semibold text-slate-900">
                      {exp.title}
                      {exp.note && <span className="block text-[11px] font-normal text-slate-500 mt-0.5">{exp.note}</span>}
                    </td>
                    <td className="px-4 py-3.5">{getCategoryBadge(exp.category)}</td>
                    {/* PARTNERS LEDGER — uncomment to restore
                    <td className="px-4 py-3.5">
                      {exp.fundingSource === 'PERSONAL_CAPITAL' ? (
                        <span className="text-blue-600 font-semibold flex items-center gap-1">
                          <Users className="h-3 w-3" /> {exp.partner?.name || 'Partner'} Capital
                        </span>
                      ) : (
                        <span className="text-slate-500">Business Profit</span>
                      )}
                    </td>
                    */}
                    <td className="px-4 py-3.5 font-mono font-bold text-rose-600 text-sm">
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
