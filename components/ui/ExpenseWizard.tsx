'use client'

import React, { useState, useEffect } from 'react'
import { X, Receipt, DollarSign, Users, Check } from 'lucide-react'

interface Partner {
  id: string
  name: string
}

interface ExpenseWizardProps {
  isOpen: boolean
  onClose: () => void
  onSuccess: () => void
}

export default function ExpenseWizard({ isOpen, onClose, onSuccess }: ExpenseWizardProps) {
  const [partners, setPartners] = useState<Partner[]>([])

  const [title, setTitle] = useState('')
  const [amount, setAmount] = useState('')
  const [category, setCategory] = useState('MARKETING_ADS')
  const [fundingSource, setFundingSource] = useState('BUSINESS_PROFIT')
  const [partnerId, setPartnerId] = useState('')
  const [note, setNote] = useState('')

  const [isSubmitting, setIsSubmitting] = useState(false)
  const [error, setError] = useState<string | null>(null)

  useEffect(() => {
    if (isOpen) {
      fetch('/api/partners')
        .then((r) => r.json())
        .then((parts) => {
          if (Array.isArray(parts)) {
            setPartners(parts)
            if (parts.length > 0) setPartnerId(parts[0].id)
          }
        })
        .catch(console.error)
    }
  }, [isOpen])

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault()
    setError(null)

    if (!title.trim() || !amount) {
      setError('Please provide expense title and amount.')
      return
    }

    setIsSubmitting(true)

    try {
      const res = await fetch('/api/expenses', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          title,
          amount,
          category,
          fundingSource,
          partnerId: fundingSource === 'PERSONAL_CAPITAL' ? partnerId : null,
          note,
        }),
      })

      if (!res.ok) {
        const data = await res.json()
        throw new Error(data.error || 'Failed to log expense')
      }

      onSuccess()
      onClose()
      setTitle('')
      setAmount('')
      setNote('')
    } catch (err: any) {
      setError(err.message || 'Expense creation failed')
    } finally {
      setIsSubmitting(false)
    }
  }

  if (!isOpen) return null

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-slate-950/80 backdrop-blur-sm animate-in fade-in">
      <div className="bg-slate-900 border border-slate-800 rounded-2xl w-full max-w-lg shadow-2xl text-slate-100 overflow-hidden flex flex-col">
        
        {/* Header */}
        <div className="flex items-center justify-between p-5 border-b border-slate-800 bg-slate-900/50">
          <div className="flex items-center gap-2">
            <div className="p-2 rounded-xl bg-rose-500/10 text-rose-400">
              <Receipt className="h-5 w-5" />
            </div>
            <div>
              <h2 className="text-base font-bold">Add Business Expense</h2>
              <p className="text-xs text-slate-400">Record operational costs and ads</p>
            </div>
          </div>
          <button onClick={onClose} className="p-1 rounded-lg text-slate-400 hover:text-white transition">
            <X className="h-5 w-5" />
          </button>
        </div>

        {/* Form Body */}
        <form onSubmit={handleSubmit} className="p-6 space-y-4">
          {error && (
            <div className="p-3 bg-rose-500/10 border border-rose-500/30 text-rose-400 text-xs rounded-xl">
              {error}
            </div>
          )}

          {/* Title */}
          <div>
            <label className="block text-xs font-semibold text-slate-300 mb-1">What did you spend money on? *</label>
            <input
              type="text"
              required
              value={title}
              onChange={(e) => setTitle(e.target.value)}
              placeholder="e.g. Facebook Ads, Packaging Flyers"
              className="w-full bg-slate-800 border border-slate-700 rounded-xl px-3 py-2 text-sm text-slate-200 focus:outline-none focus:border-rose-500 transition"
            />
          </div>

          {/* Amount & Category */}
          <div className="grid grid-cols-2 gap-3">
            <div>
              <label className="block text-xs font-semibold text-slate-300 mb-1">Amount (Rs) *</label>
              <div className="relative">
                <DollarSign className="absolute left-3 top-2.5 h-4 w-4 text-slate-500" />
                <input
                  type="number"
                  step="0.01"
                  required
                  value={amount}
                  onChange={(e) => setAmount(e.target.value)}
                  placeholder="5000"
                  className="w-full bg-slate-800 border border-slate-700 rounded-xl pl-9 pr-3 py-2 text-sm text-slate-200 focus:outline-none focus:border-rose-500 transition"
                />
              </div>
            </div>

            <div>
              <label className="block text-xs font-semibold text-slate-300 mb-1">Category *</label>
              <select
                value={category}
                onChange={(e) => setCategory(e.target.value)}
                className="w-full bg-slate-800 border border-slate-700 rounded-xl px-3 py-2 text-sm text-slate-200 focus:outline-none focus:border-rose-500 transition"
              >
                <option value="MARKETING_ADS">Marketing & Ads</option>
                <option value="PACKAGING">Packaging</option>
                <option value="COURIER_BILL">Courier Bills</option>
                <option value="LOGISTICS">Logistics</option>
                <option value="UTILITIES">Utilities</option>
                <option value="MISC">Miscellaneous</option>
              </select>
            </div>
          </div>

          {/* Who Paid? */}
          <div>
            <label className="block text-xs font-semibold text-slate-300 mb-2">Who paid for it? *</label>
            <div className="grid grid-cols-2 gap-3 text-xs font-medium">
              <button
                type="button"
                onClick={() => setFundingSource('BUSINESS_PROFIT')}
                className={`p-3 rounded-xl border text-center flex items-center justify-center gap-2 transition ${
                  fundingSource === 'BUSINESS_PROFIT'
                    ? 'bg-rose-500/10 border-rose-500 text-rose-400 font-bold'
                    : 'bg-slate-800/60 border-slate-700 text-slate-400 hover:text-slate-200'
                }`}
              >
                <DollarSign className="h-4 w-4" />
                <span>Business Profit</span>
              </button>

              <button
                type="button"
                onClick={() => setFundingSource('PERSONAL_CAPITAL')}
                className={`p-3 rounded-xl border text-center flex items-center justify-center gap-2 transition ${
                  fundingSource === 'PERSONAL_CAPITAL'
                    ? 'bg-blue-500/10 border-blue-500 text-blue-400 font-bold'
                    : 'bg-slate-800/60 border-slate-700 text-slate-400 hover:text-slate-200'
                }`}
              >
                <Users className="h-4 w-4" />
                <span>Partner Investment</span>
              </button>
            </div>
          </div>

          {/* PROGRESSIVE DISCLOSURE: PARTNER SELECTOR */}
          {fundingSource === 'PERSONAL_CAPITAL' && (
            <div className="p-3 bg-blue-500/10 border border-blue-500/20 rounded-xl space-y-2 animate-in fade-in">
              <label className="block text-xs font-semibold text-blue-400">Select Partner Investor</label>
              <select
                value={partnerId}
                onChange={(e) => setPartnerId(e.target.value)}
                className="w-full bg-slate-900 border border-slate-700 rounded-xl px-3 py-2 text-sm text-slate-200 focus:outline-none focus:border-blue-500 transition"
              >
                {partners.map((p) => (
                  <option key={p.id} value={p.id}>
                    {p.name}
                  </option>
                ))}
              </select>
            </div>
          )}

          {/* Description / Note */}
          <div>
            <label className="block text-xs font-semibold text-slate-300 mb-1">Description (Optional)</label>
            <input
              type="text"
              value={note}
              onChange={(e) => setNote(e.target.value)}
              placeholder="Additional notes..."
              className="w-full bg-slate-800 border border-slate-700 rounded-xl px-3 py-2 text-sm text-slate-200 focus:outline-none focus:border-rose-500 transition"
            />
          </div>

          {/* Footer */}
          <div className="pt-4 border-t border-slate-800 flex justify-end gap-2">
            <button
              type="button"
              onClick={onClose}
              className="px-4 py-2 bg-slate-800 hover:bg-slate-700 text-slate-300 text-xs font-semibold rounded-xl transition"
            >
              Cancel
            </button>
            <button
              type="submit"
              disabled={isSubmitting}
              className="px-6 py-2 bg-rose-500 hover:bg-rose-600 text-white font-bold text-xs rounded-xl flex items-center gap-1.5 transition shadow-lg disabled:opacity-50"
            >
              <Check className="h-4 w-4" />
              {isSubmitting ? 'Saving...' : 'Add Expense'}
            </button>
          </div>
        </form>

      </div>
    </div>
  )
}
