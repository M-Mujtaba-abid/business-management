'use client'

import React, { useEffect, useState } from 'react'
import { createPortal } from 'react-dom'
import { X, Banknote, Receipt, AlertTriangle } from 'lucide-react'

// Leopards money for one parcel (saved by the Leopards check): a clickable amount in the
// Leopards column, and a popup with the full breakdown and whether Leopards has paid.

export interface CourierMoney {
  cod: number
  shipmentCharges: number
  cashHandling: number
  insurance: number
  fuelPercent: number
  fuelAmount: number
  returnCharges: number
  otherCharges: number
  gstPercent: number
  gstAmount: number
  netCharges: number
  grossCharges: number
  extraCharges?: number // more cut in the invoice than the API shows (fuel etc.)
  totalCharges?: number
  whtPercent?: number
  whtAmount?: number // tax on the COD
  payout: number
  payment: string
  paymentWord: string | null
  invoiceNo: string | null
  invoiceDate: string | null
  chargeInvoiceNo?: string | null
  invoiceReceived?: boolean
  paymentMethod: string | null
  message: string | null
  weightGrams: number | null
}

const rs = (n: number) => `Rs. ${n.toLocaleString('en-PK', { maximumFractionDigits: 2 })}`

export function paymentChip(payment?: string | null) {
  switch (payment) {
    case 'PAID':
      return { label: 'Money received', tone: 'bg-emerald-50 text-emerald-700 border-emerald-200' }
    case 'PENDING':
      return { label: 'Invoiced, not paid', tone: 'bg-amber-50 text-amber-700 border-amber-200' }
    case 'NOT_INVOICED':
    case null:
    case undefined:
      return { label: 'Not invoiced yet', tone: 'bg-slate-100 text-slate-600 border-slate-200' }
    default:
      return { label: payment, tone: 'bg-violet-50 text-violet-700 border-violet-200' }
  }
}

interface Props {
  payout?: number | null
  payment?: string | null
  money?: CourierMoney | null
  checkedAt?: string | null
  orderNo?: number | null
  orderTotal: number // what our order says the customer pays
}

export function LeopardsMoneyButton(props: Props) {
  const [open, setOpen] = useState(false)
  if (props.payout == null || !props.money) return null
  const chip = paymentChip(props.payment)
  return (
    <>
      <button
        type="button"
        onClick={(e) => {
          e.stopPropagation()
          setOpen(true)
        }}
        title="See what Leopards collected, deducted and paid"
        className="mt-0.5 flex flex-col items-start rounded-lg border border-slate-200 bg-white px-1.5 py-1 text-left hover:border-emerald-300 hover:bg-emerald-50/50 transition max-w-full"
      >
        <span className="text-[10px] text-slate-500 leading-none">Money to you</span>
        <span className="font-mono text-[12px] font-bold text-slate-900 underline decoration-dotted underline-offset-2">{rs(props.payout)}</span>
        <span className={`mt-0.5 rounded border px-1 text-[9px] font-semibold ${chip.tone}`}>{chip.label}</span>
      </button>
      {open && <LeopardsMoneyDialog {...props} onClose={() => setOpen(false)} />}
    </>
  )
}

function LeopardsMoneyDialog({ money, payment, checkedAt, orderNo, orderTotal, onClose }: Props & { onClose: () => void }) {
  const [mounted, setMounted] = useState(false)
  useEffect(() => {
    setMounted(true)
    const onKey = (e: KeyboardEvent) => e.key === 'Escape' && onClose()
    window.addEventListener('keydown', onKey)
    return () => window.removeEventListener('keydown', onKey)
  }, [onClose])
  if (!mounted || !money) return null

  const chip = paymentChip(payment)
  const codDiffers = Math.abs(money.cod - orderTotal) >= 1
  const lines: [string, number][] = [
    ['Delivery charges', money.shipmentCharges],
    ['Cash handling', money.cashHandling],
    [`Fuel surcharge${money.fuelPercent ? ` (${money.fuelPercent}%)` : ''}`, money.fuelAmount],
    ['Insurance', money.insurance],
    ['Return charges', money.returnCharges],
    ['Other charges', money.otherCharges],
    [`GST${money.gstPercent ? ` (${money.gstPercent}%)` : ''}`, money.gstAmount],
    ['Extra cut in Leopards invoice (fuel etc.)', money.extraCharges || 0],
  ]
  const totalCharges = money.totalCharges ?? money.grossCharges
  const tax = money.whtAmount || 0

  return createPortal(
    <div className="fixed inset-0 z-[100] flex items-end sm:items-center justify-center bg-slate-900/40 p-0 sm:p-4" onClick={onClose}>
      <div
        role="dialog"
        aria-label="Leopards money"
        onClick={(e) => e.stopPropagation()}
        className="w-full sm:max-w-md max-h-[90vh] overflow-y-auto rounded-t-2xl sm:rounded-2xl bg-white shadow-xl"
      >
        <div className="flex items-center gap-2 border-b border-slate-100 px-4 py-3">
          <Banknote className="h-4 w-4 text-emerald-600" />
          <h2 className="text-sm font-bold text-slate-900">Leopards money{orderNo ? ` · Order #${orderNo}` : ''}</h2>
          <button onClick={onClose} className="ml-auto rounded-lg p-1.5 text-slate-400 hover:bg-slate-100 hover:text-slate-700" aria-label="Close">
            <X className="h-4 w-4" />
          </button>
        </div>

        <div className="space-y-4 p-4">
          <table className="w-full text-sm">
            <tbody className="divide-y divide-slate-100">
              <tr>
                <td className="py-2 text-slate-600">Cash collected from customer (COD)</td>
                <td className="py-2 text-right font-mono font-semibold text-slate-900">{rs(money.cod)}</td>
              </tr>
              {lines
                .filter(([, v]) => v > 0)
                .map(([label, v]) => (
                  <tr key={label}>
                    <td className="py-2 text-slate-600">{label}</td>
                    <td className="py-2 text-right font-mono text-rose-600">− {rs(v)}</td>
                  </tr>
                ))}
              <tr className="bg-slate-50">
                <td className="py-2 pl-2 font-semibold text-slate-700">Total Leopards charges</td>
                <td className="py-2 pr-2 text-right font-mono font-semibold text-rose-700">− {rs(totalCharges)}</td>
              </tr>
              {tax > 0 && (
                <tr>
                  <td className="py-2 text-slate-600">
                    Tax on COD ({money.whtPercent}%: income tax + sales tax)
                  </td>
                  <td className="py-2 text-right font-mono text-rose-600">− {rs(tax)}</td>
                </tr>
              )}
              <tr className="bg-emerald-50">
                <td className="py-2.5 pl-2 font-bold text-emerald-800">Money that comes to you</td>
                <td className="py-2.5 pr-2 text-right font-mono text-base font-black text-emerald-800">{rs(money.payout)}</td>
              </tr>
            </tbody>
          </table>

          {codDiffers && (
            <div className="flex gap-2 rounded-xl border border-amber-200 bg-amber-50 p-3 text-xs text-amber-800">
              <AlertTriangle className="h-4 w-4 shrink-0" />
              <span>
                Leopards collected <b>{rs(money.cod)}</b>, but this order says <b>{rs(orderTotal)}</b>. Check the COD amount booked
                with Leopards.
              </span>
            </div>
          )}

          <div className="rounded-xl border border-slate-200 p-3 space-y-1.5 text-xs">
            <div className="flex items-center gap-2">
              <Receipt className="h-3.5 w-3.5 text-slate-500" />
              <span className="font-semibold text-slate-700">Payment from Leopards</span>
              <span className={`ml-auto rounded border px-1.5 py-0.5 text-[10px] font-semibold ${chip.tone}`}>{chip.label}</span>
            </div>
            {money.invoiceNo && (
              <div className="flex justify-between text-slate-600">
                <span>Invoice (COD paid)</span>
                <span className="font-mono">{money.invoiceNo}</span>
              </div>
            )}
            {money.chargeInvoiceNo && money.chargeInvoiceNo !== money.invoiceNo && (
              <div className="flex justify-between text-slate-600">
                <span>Charges taken in</span>
                <span className="font-mono">{money.chargeInvoiceNo}</span>
              </div>
            )}
            {money.invoiceDate && (
              <div className="flex justify-between text-slate-600">
                <span>Invoice date</span>
                <span>{new Date(`${money.invoiceDate}T12:00:00`).toLocaleDateString('en-GB', { day: 'numeric', month: 'short', year: 'numeric' })}</span>
              </div>
            )}
            {money.paymentMethod && (
              <div className="flex justify-between text-slate-600">
                <span>Method</span>
                <span>{money.paymentMethod}</span>
              </div>
            )}
            {money.message && <p className="text-slate-500">{money.message}</p>}
            <p className="pt-1 text-[11px] text-slate-400">
              {payment === 'PAID'
                ? 'The invoice money has reached you, so this order is marked Received with this amount.'
                : 'When the invoice money reaches the bank, press "Money received" on it in Payments → Leopards payments.'}
            </p>
          </div>

          {checkedAt && (
            <p className="text-center text-[10px] text-slate-400">
              Checked with Leopards {new Date(checkedAt).toLocaleString('en-GB', { day: 'numeric', month: 'short', hour: '2-digit', minute: '2-digit' })}
            </p>
          )}
        </div>
      </div>
    </div>,
    document.body
  )
}
