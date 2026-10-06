'use client'

import React, { useState, useEffect } from 'react'
import { X, Banknote } from 'lucide-react'

interface ReceivePaymentModalProps {
  sale: {
    id: string
    productName: string
    soldPrice: number
    quantity: number
    receivedAmount?: number | null
    paymentSource?: { name: string } | null
    receivedBy?: { name: string } | null
  } | null
  // 'receive' marks the payment Received; 'edit' only changes the amount
  mode: 'receive' | 'edit'
  onClose: () => void
  onConfirm: (saleId: string, receivedAmount: number, markReceived: boolean) => Promise<void>
}

const formatPKR = (n: number) => `Rs. ${Math.round(n).toLocaleString()}`

export default function ReceivePaymentModal({ sale, mode, onClose, onConfirm }: ReceivePaymentModalProps) {
  const [amount, setAmount] = useState('')
  const [isSaving, setIsSaving] = useState(false)

  const saleTotal = sale ? sale.soldPrice * sale.quantity : 0

  useEffect(() => {
    if (sale) setAmount(String(sale.receivedAmount ?? saleTotal))
  }, [sale, saleTotal])

  if (!sale) return null

  const amt = parseFloat(amount)
  const valid = !isNaN(amt) && amt >= 0
  const cut = valid ? saleTotal - amt : 0

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault()
    if (!valid) return
    setIsSaving(true)
    try {
      await onConfirm(sale.id, amt, mode === 'receive')
      onClose()
    } finally {
      setIsSaving(false)
    }
  }

  return (
    <div className="fixed inset-0 z-50 flex items-end sm:items-center justify-center sm:p-4 bg-slate-900/30 backdrop-blur-sm animate-in fade-in">
      <div className="bg-white border border-slate-200 rounded-t-2xl sm:rounded-2xl w-full max-w-sm shadow-2xl text-slate-900 overflow-hidden">
        <div className="flex items-center justify-between p-4 border-b border-slate-200">
          <div className="flex items-center gap-2">
            <div className="p-2 rounded-lg bg-emerald-500/10 text-emerald-600">
              <Banknote className="h-5 w-5" />
            </div>
            <div>
              <h3 className="font-bold">{mode === 'receive' ? 'Payment received' : 'Edit received amount'}</h3>
              <p className="text-[11px] text-slate-500 truncate max-w-[220px]">{sale.productName}</p>
            </div>
          </div>
          <button onClick={onClose} className="p-1 text-slate-500 hover:text-slate-900 rounded-lg">
            <X className="h-5 w-5" />
          </button>
        </div>

        <form onSubmit={handleSubmit} className="p-4 space-y-4 pb-[max(1rem,env(safe-area-inset-bottom))]">
          <div className="text-xs text-slate-600 space-y-0.5">
            <div>
              Sale amount: <b className="font-mono">{formatPKR(saleTotal)}</b>
            </div>
            {(sale.paymentSource?.name || sale.receivedBy?.name) && (
              <div>
                {sale.paymentSource?.name || 'Payment'}
                {sale.receivedBy?.name ? ` → ${sale.receivedBy.name}` : ''}
              </div>
            )}
          </div>

          <div>
            <label className="block text-xs font-semibold text-slate-700 mb-1">Actual amount received (Rs)</label>
            <input
              type="number"
              min="0"
              step="0.01"
              autoFocus
              value={amount}
              onChange={(e) => setAmount(e.target.value)}
              className="w-full bg-white border border-slate-300 rounded-xl px-3 py-2.5 text-base font-mono text-slate-900 focus:outline-none focus:border-emerald-500"
            />
            <p className="text-[11px] text-slate-500 mt-1">The amount that actually reached the account, after Daraz / courier tax or fees.</p>
          </div>

          {valid && Math.abs(cut) >= 0.5 && (
            <div
              className={`rounded-xl px-3 py-2 text-xs border ${
                cut > 0 ? 'bg-rose-50 border-rose-200 text-rose-700' : 'bg-emerald-50 border-emerald-200 text-emerald-700'
              }`}
            >
              {cut > 0
                ? `${formatPKR(cut)} was cut (tax / fees). This is subtracted from the order's profit.`
                : `${formatPKR(-cut)} more than the sale amount. This is added to the order's profit.`}
            </div>
          )}

          <button
            type="submit"
            disabled={!valid || isSaving}
            className="w-full py-2.5 rounded-xl bg-emerald-500 hover:bg-emerald-600 text-white font-bold text-sm disabled:opacity-50"
          >
            {isSaving ? 'Saving...' : mode === 'receive' ? 'Mark as Received' : 'Save amount'}
          </button>
        </form>
      </div>
    </div>
  )
}
