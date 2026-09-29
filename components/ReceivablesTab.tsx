'use client'

import React, { useState, useEffect, useCallback } from 'react'
import { Banknote, AlertTriangle, ArrowUpRight, CheckCircle2 } from 'lucide-react'
import { toast } from 'sonner'

interface SourceSummary {
  id: string | null
  name: string
  pendingAmount: number
  pendingCount: number
  pendingSaleIds: string[]
  oldestPendingAt: string | null
}

interface ReceivablesTabProps {
  onViewOrders: (paymentSourceId: string) => void // source id, or 'none'
  onChanged?: () => void
  refreshKey?: number
}

const LATE_DAYS = 15

// Money still to come in for delivered orders, grouped by who pays us (Daraz, Leopards, ...)
export default function ReceivablesTab({ onViewOrders, onChanged, refreshKey }: ReceivablesTabProps) {
  const [summary, setSummary] = useState<SourceSummary[]>([])
  const [isLoading, setIsLoading] = useState(true)
  const [updatingKey, setUpdatingKey] = useState<string | null>(null)

  const fetchSummary = useCallback(() => {
    setIsLoading(true)
    fetch('/api/payment-sources/summary')
      .then((r) => r.json())
      .then((data) => {
        if (Array.isArray(data)) setSummary(data)
      })
      .catch(console.error)
      .finally(() => setIsLoading(false))
  }, [])

  useEffect(() => {
    fetchSummary()
  }, [fetchSummary, refreshKey])

  const handleReceiveAll = async (src: SourceSummary) => {
    if (!confirm(`Mark ${src.pendingCount} order(s) from ${src.name} (Rs. ${src.pendingAmount.toLocaleString()}) as Received?`)) return
    const key = src.id || 'none'
    setUpdatingKey(key)
    try {
      const res = await fetch('/api/sales/customer-payment', {
        method: 'PATCH',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ saleIds: src.pendingSaleIds, status: 'RECEIVED' }),
      })
      if (!res.ok) throw new Error((await res.json()).error || 'Failed to update payment')
      toast.success(`${src.name} payment marked as received`)
      fetchSummary()
      onChanged?.()
    } catch (err: any) {
      toast.error(err.message || 'Failed to update payment')
    } finally {
      setUpdatingKey(null)
    }
  }

  const daysSince = (iso: string) => Math.floor((Date.now() - new Date(iso).getTime()) / 86400000)
  const totalPending = summary.reduce((acc, s) => acc + s.pendingAmount, 0)
  const sorted = [...summary].sort((a, b) => b.pendingAmount - a.pendingAmount || a.name.localeCompare(b.name))

  return (
    <div className="bg-white border border-slate-200 rounded-2xl p-5 shadow-sm space-y-4">
      <div className="flex flex-wrap items-center justify-between gap-2">
        <div>
          <h2 className="text-base font-bold text-slate-900 flex items-center gap-2">
            <Banknote className="h-5 w-5 text-emerald-600" /> Money to Receive
          </h2>
          <p className="text-xs text-slate-500">Payments not yet received for delivered orders</p>
        </div>
        <div className="text-right">
          <div className="text-[11px] text-slate-500">Total to receive</div>
          <div className="text-lg font-black font-mono text-emerald-600">Rs. {totalPending.toLocaleString()}</div>
        </div>
      </div>

      {isLoading ? (
        <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-3">
          {[...Array(3)].map((_, i) => (
            <div key={i} className="h-32 bg-slate-100/40 rounded-xl animate-pulse" />
          ))}
        </div>
      ) : sorted.length === 0 ? (
        <p className="text-xs text-slate-500 p-6 text-center border border-dashed border-slate-200 rounded-xl">
          No payment sources yet. Add one from the New Order form.
        </p>
      ) : (
        <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-3">
          {sorted.map((src) => {
            const key = src.id || 'none'
            const age = src.oldestPendingAt ? daysSince(src.oldestPendingAt) : 0
            const late = src.pendingCount > 0 && age >= LATE_DAYS
            return (
              <div
                key={key}
                className={`rounded-xl p-4 space-y-3 border ${
                  late
                    ? 'bg-rose-500/10 border-rose-500/40'
                    : src.pendingCount > 0
                    ? 'bg-emerald-500/5 border-emerald-500/20'
                    : 'bg-slate-50 border-slate-200'
                }`}
              >
                <div className="flex items-start justify-between">
                  <h3 className="font-bold text-slate-900">{src.name}</h3>
                  {late && (
                    <span className="px-2 py-0.5 rounded-full text-[10px] font-bold bg-rose-500/20 text-rose-700 border border-rose-500/40 flex items-center gap-1">
                      <AlertTriangle className="h-3 w-3" /> {age} days
                    </span>
                  )}
                </div>

                {src.pendingCount > 0 ? (
                  <div>
                    <div className={`text-xl font-black font-mono ${late ? 'text-rose-600' : 'text-emerald-600'}`}>
                      Rs. {src.pendingAmount.toLocaleString()}
                    </div>
                    <p className="text-[11px] text-slate-500">
                      {src.pendingCount} order(s) not received · oldest {age} days
                    </p>
                  </div>
                ) : (
                  <div className="flex items-center gap-1.5 text-emerald-600 text-xs font-semibold">
                    <CheckCircle2 className="h-4 w-4" /> All received
                  </div>
                )}

                <div className="flex gap-2">
                  <button
                    onClick={() => onViewOrders(key)}
                    className="flex-1 px-2 py-1.5 rounded-lg bg-white border border-slate-200 hover:bg-slate-50 text-slate-700 text-[11px] font-semibold flex items-center justify-center gap-1"
                  >
                    View orders <ArrowUpRight className="h-3 w-3" />
                  </button>
                  {src.pendingCount > 0 && (
                    <button
                      onClick={() => handleReceiveAll(src)}
                      disabled={updatingKey === key}
                      className="flex-1 px-2 py-1.5 rounded-lg bg-emerald-500 hover:bg-emerald-600 text-white text-[11px] font-bold disabled:opacity-50"
                    >
                      {updatingKey === key ? 'Updating...' : 'All received'}
                    </button>
                  )}
                </div>
              </div>
            )
          })}
        </div>
      )}
    </div>
  )
}
