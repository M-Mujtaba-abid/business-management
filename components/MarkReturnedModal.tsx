'use client'

import React, { useState, useEffect } from 'react'
import { X, RotateCcw, AlertTriangle, Recycle } from 'lucide-react'

interface MarkReturnedModalProps {
  isOpen: boolean
  sale: {
    id: string
    customerName: string
    productName: string
    deliveryCharge: number
    petrolCost?: number
    costPrice: number
    quantity: number
  } | null
  onClose: () => void
  onConfirm: (saleId: string, returnLoss: number, coverReturned: boolean) => void
  isSubmitting?: boolean
}

export default function MarkReturnedModal({
  isOpen,
  sale,
  onClose,
  onConfirm,
  isSubmitting,
}: MarkReturnedModalProps) {
  const [coverReturned, setCoverReturned] = useState(true)
  const [loss, setLoss] = useState('')

  const baseLoss = sale ? sale.deliveryCharge + (sale.petrolCost || 0) : 0
  const coverCost = sale ? sale.costPrice * sale.quantity : 0

  // Prefill: DC + petrol; if the cover is lost/damaged, its cost is lost too
  useEffect(() => {
    if (!sale) return
    setLoss(String(coverReturned ? baseLoss : baseLoss + coverCost))
  }, [sale, coverReturned, baseLoss, coverCost])

  useEffect(() => {
    if (isOpen) setCoverReturned(true)
  }, [isOpen])

  if (!isOpen || !sale) return null

  const lossNum = parseFloat(loss) || 0

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-slate-900/30 backdrop-blur-sm animate-in fade-in">
      <div className="bg-white border border-slate-200 rounded-2xl w-full max-w-md shadow-2xl text-slate-900 overflow-hidden">

        {/* Header */}
        <div className="flex items-center justify-between p-5 border-b border-slate-200">
          <div className="flex items-center gap-2">
            <div className="p-2 rounded-lg bg-rose-500/10 text-rose-600">
              <RotateCcw className="h-5 w-5" />
            </div>
            <h3 className="font-bold text-lg">Mark Order Returned</h3>
          </div>
          <button onClick={onClose} className="p-1 text-slate-500 hover:text-slate-900 rounded-lg">
            <X className="h-5 w-5" />
          </button>
        </div>

        {/* Body */}
        <div className="p-6 space-y-4 text-sm">
          <div className="bg-slate-100/60 border border-slate-300/60 rounded-lg p-3 space-y-1 text-xs">
            <p className="text-slate-700"><span className="font-semibold text-slate-900">Product:</span> {sale.productName} x{sale.quantity}</p>
            <p className="text-slate-700"><span className="font-semibold text-slate-900">Customer:</span> {sale.customerName}</p>
            <p className="text-slate-700">
              <span className="font-semibold text-slate-900">DC:</span> Rs. {sale.deliveryCharge}
              {' · '}
              <span className="font-semibold text-slate-900">Petrol:</span> Rs. {sale.petrolCost || 0}
              {' · '}
              <span className="font-semibold text-slate-900">Cover cost:</span> Rs. {coverCost}
            </p>
          </div>

          {/* Cover back toggle */}
          <label className="flex items-start gap-3 bg-emerald-500/5 border border-emerald-500/20 p-3.5 rounded-xl cursor-pointer">
            <input
              type="checkbox"
              checked={coverReturned}
              onChange={(e) => setCoverReturned(e.target.checked)}
              className="h-4 w-4 mt-0.5 rounded accent-emerald-500"
            />
            <div>
              <span className="font-semibold text-slate-800 flex items-center gap-1.5">
                <Recycle className="h-4 w-4 text-emerald-600" /> Cover came back
              </span>
              <p className="text-xs text-slate-500 mt-0.5">
                {coverReturned
                  ? 'The cover goes to Returned stock and can be used in a future order.'
                  : 'Cover is damaged or lost. Its cost is added to the loss.'}
              </p>
            </div>
          </label>

          {/* Loss amount */}
          <div className="flex items-start gap-3 bg-rose-500/10 border border-rose-500/20 p-3.5 rounded-xl">
            <AlertTriangle className="h-5 w-5 text-rose-600 shrink-0 mt-0.5" />
            <div className="flex-1 space-y-1.5">
              <label className="block font-semibold text-slate-800">Loss (Rs)</label>
              <input
                type="number"
                min="0"
                step="0.01"
                value={loss}
                onChange={(e) => setLoss(e.target.value)}
                className="w-full bg-white border border-slate-300 rounded-lg px-3 py-2 text-sm text-slate-800 focus:outline-none focus:border-rose-500"
              />
              <p className="text-xs text-slate-500">This amount is subtracted from net profit.</p>
            </div>
          </div>

          {/* Action Buttons */}
          <div className="pt-2 flex justify-end gap-3">
            <button
              onClick={onClose}
              className="px-4 py-2 rounded-lg bg-slate-100 hover:bg-slate-200 text-slate-700 text-xs font-medium transition"
            >
              Cancel
            </button>
            <button
              onClick={() => onConfirm(sale.id, lossNum, coverReturned)}
              disabled={isSubmitting}
              className="px-4 py-2 rounded-lg bg-rose-500 hover:bg-rose-600 text-white font-bold text-xs transition shadow-lg shadow-rose-500/20 disabled:opacity-50"
            >
              {isSubmitting ? 'Updating...' : 'Confirm Return'}
            </button>
          </div>

        </div>

      </div>
    </div>
  )
}
