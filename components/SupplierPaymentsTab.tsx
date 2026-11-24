'use client'

import React, { useState, useEffect, useCallback } from 'react'
import { Wallet, AlertTriangle, ArrowUpRight, CheckCircle2 } from 'lucide-react'
import { toast } from 'sonner'

interface SupplierSummary {
  id: string
  name: string
  phone?: string | null
  pendingAmount: number
  pendingCount: number
  pendingSaleIds: string[]
  oldestPendingAt: string | null
}

interface SupplierPaymentsTabProps {
  onViewOrders: (supplierId: string) => void
  onChanged?: () => void
}

const OVERDUE_DAYS = 15

export default function SupplierPaymentsTab({ onViewOrders, onChanged }: SupplierPaymentsTabProps) {
  const [summary, setSummary] = useState<SupplierSummary[]>([])
  const [isLoading, setIsLoading] = useState(true)
  const [payingId, setPayingId] = useState<string | null>(null)

  const fetchSummary = useCallback(() => {
    setIsLoading(true)
    fetch('/api/suppliers/summary')
      .then((r) => r.json())
      .then((data) => {
        if (Array.isArray(data)) setSummary(data)
      })
      .catch(console.error)
      .finally(() => setIsLoading(false))
  }, [])

  useEffect(() => {
    fetchSummary()
  }, [fetchSummary])

  // Who pays suppliers (default + one-time fix for older payments)
  const [payers, setPayers] = useState<{
    defaultPayerId: string | null
    people: { id: string; name: string }[]
    legacy: { orders: number; cover: number; byReceiver: { name: string; orders: number; cover: number }[] }
  } | null>(null)
  const [backfilling, setBackfilling] = useState(false)
  const loadPayers = useCallback(() => {
    fetch('/api/supplier-payers')
      .then((r) => r.json())
      .then((d) => !d.error && setPayers(d))
      .catch(() => {})
  }, [])
  useEffect(loadPayers, [loadPayers])
  const payerName = (id: string | null | undefined) => payers?.people.find((p) => p.id === id)?.name || 'the default payer'

  const saveDefaultPayer = async (id: string) => {
    const res = await fetch('/api/supplier-payers', { method: 'PUT', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify({ defaultPayerId: id }) })
    if (!res.ok) return toast.error((await res.json()).error || 'Could not save')
    toast.success(`Suppliers are now paid by ${payerName(id)} by default`)
    loadPayers()
  }

  const backfill = async (id: string, name: string) => {
    if (!payers) return
    if (!confirm(`Record ${name} as the payer of all ${payers.legacy.orders} older supplier payments (Rs. ${payers.legacy.cover.toLocaleString()})?`)) return
    setBackfilling(true)
    try {
      const res = await fetch('/api/supplier-payers', { method: 'POST', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify({ personId: id }) })
      const d = await res.json()
      if (!res.ok) throw new Error(d.error || 'Could not save')
      toast.success(`${d.orders} older supplier payments recorded as paid by ${name}`)
      loadPayers()
      onChanged?.()
    } catch (e: any) {
      toast.error(e.message)
    } finally {
      setBackfilling(false)
    }
  }

  const handlePayAll = async (sup: SupplierSummary) => {
    if (!confirm(`Mark ${sup.pendingCount} pending order(s) for ${sup.name} (Rs. ${sup.pendingAmount.toLocaleString()}) as Paid?\n\nPaid by: ${payerName(payers?.defaultPayerId)}`)) return
    setPayingId(sup.id)
    try {
      const res = await fetch('/api/sales/supplier-payment', {
        method: 'PATCH',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ saleIds: sup.pendingSaleIds, status: 'PAID', paidById: payers?.defaultPayerId || null }),
      })
      if (!res.ok) throw new Error((await res.json()).error || 'Failed to update payment')
      toast.success(`${sup.name} marked as paid`)
      fetchSummary()
      onChanged?.()
    } catch (err: any) {
      toast.error(err.message || 'Failed to update payment')
    } finally {
      setPayingId(null)
    }
  }

  const daysSince = (iso: string) => Math.floor((Date.now() - new Date(iso).getTime()) / 86400000)
  const totalPending = summary.reduce((acc, s) => acc + s.pendingAmount, 0)
  // Suppliers with something pending first, then by name
  const sorted = [...summary].sort((a, b) => b.pendingAmount - a.pendingAmount || a.name.localeCompare(b.name))

  return (
    <div className="bg-white border border-slate-200 rounded-2xl p-5 shadow-sm space-y-4">
      <div className="flex flex-wrap items-center justify-between gap-2">
        <div>
          <h2 className="text-base font-bold text-slate-900 flex items-center gap-2">
            <Wallet className="h-5 w-5 text-amber-600" /> Supplier Payments
          </h2>
          <p className="text-xs text-slate-500">How much you still owe each supplier</p>
        </div>
        <div className="text-right">
          <div className="text-[11px] text-slate-500">Total pending</div>
          <div className="text-lg font-black font-mono text-amber-600">Rs. {totalPending.toLocaleString()}</div>
        </div>
      </div>

      {/* Who pays the suppliers: default Mujtaba, can be changed (used by every "Paid") */}
      {payers && (
        <div className="flex flex-wrap items-center gap-2 rounded-xl border border-slate-200 bg-slate-50 px-3 py-2 text-xs">
          <span className="font-semibold text-slate-700">Suppliers are paid by:</span>
          {payers.people.map((p) => (
            <button
              key={p.id}
              onClick={() => saveDefaultPayer(p.id)}
              className={`rounded-lg border px-2.5 py-1 font-bold ${payers.defaultPayerId === p.id ? 'border-violet-400 bg-violet-600 text-white' : 'border-slate-200 bg-white text-slate-500'}`}
            >
              {p.name}
            </button>
          ))}
          <span className="text-[11px] text-slate-500">— the cover cost leaves this person&apos;s In hand when a supplier is marked Paid</span>
        </div>
      )}

      {/* One time: older "Paid" supplier payments with no payer recorded */}
      {payers && payers.legacy.orders > 0 && (
        <div className="rounded-xl border border-violet-200 bg-violet-50 p-3 text-xs space-y-2">
          <div className="font-bold text-violet-900">
            {payers.legacy.orders} older supplier payments (Rs. {payers.legacy.cover.toLocaleString()}) have no payer recorded
          </div>
          <ul className="list-disc pl-4 text-violet-800">
            {payers.legacy.byReceiver.map((r) => (
              <li key={r.name}>
                Orders whose money went to <b>{r.name}</b>: {r.orders} · cover Rs. {r.cover.toLocaleString()}
              </li>
            ))}
          </ul>
          <p className="text-[11px] text-violet-700">
            Recording who paid them makes In hand match the bank. If the payer is the same person who got the order money, nothing changes for
            them; otherwise the payer goes down and the order&apos;s receiver goes up by the cover cost.
          </p>
          <div className="flex flex-wrap gap-2">
            {payers.people.map((p) => (
              <button
                key={p.id}
                disabled={backfilling}
                onClick={() => backfill(p.id, p.name)}
                className="rounded-lg bg-violet-600 px-3 py-1.5 font-bold text-white hover:bg-violet-700 disabled:opacity-50"
              >
                All paid by {p.name}
              </button>
            ))}
          </div>
        </div>
      )}

      {isLoading ? (
        <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-3">
          {[...Array(3)].map((_, i) => (
            <div key={i} className="h-32 bg-slate-100/40 rounded-xl animate-pulse" />
          ))}
        </div>
      ) : sorted.length === 0 ? (
        <p className="text-xs text-slate-500 p-6 text-center border border-dashed border-slate-200 rounded-xl">
          No suppliers yet. Add one from the New Order form.
        </p>
      ) : (
        <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-3">
          {sorted.map((sup) => {
            const age = sup.oldestPendingAt ? daysSince(sup.oldestPendingAt) : 0
            const overdue = sup.pendingCount > 0 && age >= OVERDUE_DAYS
            return (
              <div
                key={sup.id}
                className={`rounded-xl p-4 space-y-3 border ${
                  overdue
                    ? 'bg-rose-500/10 border-rose-500/40'
                    : sup.pendingCount > 0
                    ? 'bg-amber-500/5 border-amber-500/20'
                    : 'bg-slate-100/50 border-slate-300/60'
                }`}
              >
                <div className="flex items-start justify-between">
                  <div>
                    <h3 className="font-bold text-slate-900">{sup.name}</h3>
                    {sup.phone && <p className="text-[11px] text-slate-500">{sup.phone}</p>}
                  </div>
                  {overdue && (
                    <span className="px-2 py-0.5 rounded-full text-[10px] font-bold bg-rose-500/20 text-rose-700 border border-rose-500/40 flex items-center gap-1">
                      <AlertTriangle className="h-3 w-3" /> {age} days
                    </span>
                  )}
                </div>

                {sup.pendingCount > 0 ? (
                  <div>
                    <div className={`text-xl font-black font-mono ${overdue ? 'text-rose-600' : 'text-amber-600'}`}>
                      Rs. {sup.pendingAmount.toLocaleString()}
                    </div>
                    <p className="text-[11px] text-slate-500">
                      {sup.pendingCount} order(s) pending · oldest {age} days
                    </p>
                  </div>
                ) : (
                  <div className="flex items-center gap-1.5 text-emerald-600 text-xs font-semibold">
                    <CheckCircle2 className="h-4 w-4" /> All paid
                  </div>
                )}

                <div className="flex gap-2">
                  <button
                    onClick={() => onViewOrders(sup.id)}
                    className="flex-1 px-2 py-1.5 rounded-lg bg-slate-100 hover:bg-slate-200 text-slate-700 text-[11px] font-semibold flex items-center justify-center gap-1"
                  >
                    View orders <ArrowUpRight className="h-3 w-3" />
                  </button>
                  {sup.pendingCount > 0 && (
                    <button
                      onClick={() => handlePayAll(sup)}
                      disabled={payingId === sup.id}
                      className="flex-1 px-2 py-1.5 rounded-lg bg-emerald-500 hover:bg-emerald-600 text-white text-[11px] font-bold disabled:opacity-50"
                    >
                      {payingId === sup.id ? 'Updating...' : 'Pay all pending'}
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
