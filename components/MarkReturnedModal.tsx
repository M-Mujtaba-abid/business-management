'use client'

import React, { useState } from 'react'
import { X, RotateCcw, AlertTriangle } from 'lucide-react'

interface MarkReturnedModalProps {
  isOpen: boolean
  sale: {
    id: string
    customerName: string
    productName: string
    deliveryCharge: number
  } | null
  onClose: () => void
  onConfirm: (saleId: string, deductDeliveryOnReturn: boolean) => void
  isSubmitting?: boolean
}

export default function MarkReturnedModal({
  isOpen,
  sale,
  onClose,
  onConfirm,
  isSubmitting,
}: MarkReturnedModalProps) {
  const [deductDelivery, setDeductDelivery] = useState(true)

  if (!isOpen || !sale) return null

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-slate-950/80 backdrop-blur-sm animate-in fade-in">
      <div className="bg-slate-900 border border-slate-800 rounded-2xl w-full max-w-md shadow-2xl text-slate-100 overflow-hidden">
        
        {/* Header */}
        <div className="flex items-center justify-between p-5 border-b border-slate-800">
          <div className="flex items-center gap-2">
            <div className="p-2 rounded-lg bg-rose-500/10 text-rose-400">
              <RotateCcw className="h-5 w-5" />
            </div>
            <h3 className="font-bold text-lg">Mark Order Returned</h3>
          </div>
          <button onClick={onClose} className="p-1 text-slate-400 hover:text-white rounded-lg">
            <X className="h-5 w-5" />
          </button>
        </div>

        {/* Body */}
        <div className="p-6 space-y-4 text-sm">
          <div className="bg-slate-800/60 border border-slate-700/60 rounded-lg p-3 space-y-1 text-xs">
            <p className="text-slate-300"><span className="font-semibold text-white">Customer:</span> {sale.customerName}</p>
            <p className="text-slate-300"><span className="font-semibold text-white">Product:</span> {sale.productName}</p>
            <p className="text-slate-300"><span className="font-semibold text-white">Delivery Fee:</span> Rs. {sale.deliveryCharge}</p>
          </div>

          <div className="flex items-start gap-3 bg-rose-500/10 border border-rose-500/20 p-3.5 rounded-xl">
            <AlertTriangle className="h-5 w-5 text-rose-400 shrink-0 mt-0.5" />
            <div className="space-y-2">
              <label className="flex items-center gap-2 cursor-pointer font-semibold text-slate-200">
                <input
                  type="checkbox"
                  checked={deductDelivery}
                  onChange={(e) => setDeductDelivery(e.target.checked)}
                  className="h-4 w-4 rounded accent-rose-500 bg-slate-800 border-slate-700 focus:ring-0"
                />
                Absorb Delivery Fee as Return Loss?
              </label>
              <p className="text-xs text-slate-400 leading-relaxed">
                {deductDelivery
                  ? `Rs. ${sale.deliveryCharge} delivery fee will be deducted as Courier Return Loss from True Net Profit.`
                  : 'Courier return loss will not be deducted (Net profit = Rs. 0).'}
              </p>
            </div>
          </div>

          {/* Action Buttons */}
          <div className="pt-2 flex justify-end gap-3">
            <button
              onClick={onClose}
              className="px-4 py-2 rounded-lg bg-slate-800 hover:bg-slate-700 text-slate-300 text-xs font-medium transition"
            >
              Cancel
            </button>
            <button
              onClick={() => onConfirm(sale.id, deductDelivery)}
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
