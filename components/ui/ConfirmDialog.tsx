'use client'

import React from 'react'
import { AlertTriangle, X } from 'lucide-react'

interface ConfirmDialogProps {
  isOpen: boolean
  title: string
  message: string
  confirmText?: string
  confirmVariant?: 'danger' | 'warning' | 'primary'
  onClose: () => void
  onConfirm: () => void
}

export default function ConfirmDialog({
  isOpen,
  title,
  message,
  confirmText = 'Confirm',
  confirmVariant = 'danger',
  onClose,
  onConfirm,
}: ConfirmDialogProps) {
  if (!isOpen) return null

  const getButtonClass = () => {
    switch (confirmVariant) {
      case 'danger':
        return 'bg-rose-500 hover:bg-rose-600 text-white'
      case 'warning':
        return 'bg-amber-500 hover:bg-amber-600 text-white font-bold'
      default:
        return 'bg-emerald-500 hover:bg-emerald-600 text-white font-bold'
    }
  }

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-slate-900/30 backdrop-blur-sm animate-in fade-in">
      <div className="bg-white border border-slate-200 rounded-2xl w-full max-w-md p-6 shadow-2xl space-y-4 text-slate-900">
        <div className="flex justify-between items-start">
          <div className="flex items-center gap-3">
            <div className="p-2.5 rounded-xl bg-rose-500/10 text-rose-600 border border-rose-500/20">
              <AlertTriangle className="h-5 w-5" />
            </div>
            <h3 className="font-bold text-base">{title}</h3>
          </div>
          <button onClick={onClose} className="text-slate-500 hover:text-slate-900 p-1 rounded-lg">
            <X className="h-5 w-5" />
          </button>
        </div>

        <p className="text-xs text-slate-700 leading-relaxed">{message}</p>

        <div className="flex justify-end gap-2.5 pt-3 border-t border-slate-200">
          <button
            onClick={onClose}
            className="px-4 py-2 rounded-lg bg-slate-100 hover:bg-slate-200 text-slate-700 text-xs font-semibold transition"
          >
            Cancel
          </button>
          <button
            onClick={() => {
              onConfirm()
              onClose()
            }}
            className={`px-4 py-2 rounded-lg text-xs font-bold transition shadow-md ${getButtonClass()}`}
          >
            {confirmText}
          </button>
        </div>
      </div>
    </div>
  )
}
