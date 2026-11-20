'use client'

import React, { useCallback, useEffect, useMemo, useState } from 'react'
import { createPortal } from 'react-dom'
import { toast } from 'sonner'
import {
  Boxes,
  Search,
  Plus,
  ShoppingBag,
  SlidersHorizontal,
  Pencil,
  History,
  X,
  Loader2,
  Trash2,
  ArrowDownCircle,
  ArrowUpCircle,
  Archive,
} from 'lucide-react'

// Inventory page: our own stock. Add items, buy stock (who paid: from in hand or from savings),
// correct the count, and see every stock movement.

interface Option {
  id: string
  name: string
}
interface Item {
  id: string
  name: string
  stockQty: number
  avgCost: number
  salePrice: number | null
  lowStockAt: number | null
  active: boolean
  categoryId: string | null
  supplierId: string | null
  category: Option | null
  supplier: Option | null
}
interface LogLine {
  id: string
  action: string
  qtyChange: number
  qtyAfter: number
  amount: number | null
  orderNo: number | null
  message: string
  source: string
  actor: string | null
  createdAt: string
  item?: { name: string }
}

const rs = (n: number | null | undefined) => (n == null ? '—' : `Rs. ${Math.round(n).toLocaleString('en-PK')}`)
const input =
  'w-full bg-white border border-slate-300 rounded-lg px-3 py-2 text-sm text-slate-800 focus:outline-none focus:border-teal-500'
const label = 'block text-[11px] font-semibold text-slate-600 mb-1'

async function send(url: string, method: string, body?: unknown) {
  const res = await fetch(url, { method, headers: { 'Content-Type': 'application/json' }, body: body ? JSON.stringify(body) : undefined })
  const data = await res.json().catch(() => ({}))
  if (!res.ok) throw new Error(data.error || 'Something went wrong')
  return data
}

function Modal({ title, onClose, children, wide }: { title: string; onClose: () => void; children: React.ReactNode; wide?: boolean }) {
  const [mounted, setMounted] = useState(false)
  useEffect(() => setMounted(true), [])
  if (!mounted) return null
  return createPortal(
    <div className="fixed inset-0 z-[100] flex items-end sm:items-center justify-center bg-slate-900/40 sm:p-4" onClick={onClose}>
      <div
        onClick={(e) => e.stopPropagation()}
        className={`w-full ${wide ? 'sm:max-w-2xl' : 'sm:max-w-lg'} max-h-[92vh] overflow-y-auto rounded-t-2xl sm:rounded-2xl bg-white shadow-xl`}
      >
        <div className="sticky top-0 z-10 flex items-center gap-2 border-b border-slate-100 bg-white px-4 py-3">
          <h2 className="text-sm font-bold text-slate-900">{title}</h2>
          <button onClick={onClose} className="ml-auto rounded-lg p-1.5 text-slate-400 hover:bg-slate-100 hover:text-slate-700" aria-label="Close">
            <X className="h-4 w-4" />
          </button>
        </div>
        <div className="p-4">{children}</div>
      </div>
    </div>,
    document.body
  )
}

// ── Who paid for stock: one or more rows (person · amount · from in hand / from savings) ──
interface PayRow {
  personId: string
  amount: string
  kind: 'BUSINESS' | 'SAVINGS'
}
function PaymentsEditor({ people, total, rows, setRows }: { people: Option[]; total: number; rows: PayRow[]; setRows: (r: PayRow[]) => void }) {
  const paid = rows.reduce((a, r) => a + (parseFloat(r.amount) || 0), 0)
  const left = Math.round((total - paid) * 100) / 100
  const update = (i: number, patch: Partial<PayRow>) => setRows(rows.map((r, j) => (j === i ? { ...r, ...patch } : r)))
  return (
    <div className="space-y-2">
      <div className="flex items-center justify-between">
        <span className={label + ' mb-0'}>Who paid</span>
        <span className={`text-[11px] font-semibold ${Math.abs(left) < 0.5 ? 'text-emerald-600' : 'text-amber-600'}`}>
          {Math.abs(left) < 0.5 ? 'Fully covered ✓' : left > 0 ? `${rs(left)} still to cover` : `${rs(-left)} too much`}
        </span>
      </div>
      {rows.map((r, i) => (
        <div key={i} className="grid grid-cols-[1fr_110px_auto] gap-2 items-center">
          <select value={r.personId} onChange={(e) => update(i, { personId: e.target.value })} className={input}>
            <option value="">Person…</option>
            {people.map((p) => (
              <option key={p.id} value={p.id}>
                {p.name}
              </option>
            ))}
          </select>
          <input type="number" min="0" step="0.01" value={r.amount} onChange={(e) => update(i, { amount: e.target.value })} placeholder="Amount" className={input} />
          <div className="flex items-center gap-1">
            <div className="flex rounded-lg border border-slate-200 p-0.5">
              {(['BUSINESS', 'SAVINGS'] as const).map((k) => (
                <button
                  key={k}
                  type="button"
                  onClick={() => update(i, { kind: k })}
                  title={k === 'BUSINESS' ? 'From business money in hand (lowers their In hand)' : 'From personal savings (an investment)'}
                  className={`rounded-md px-2 py-1 text-[11px] font-bold ${
                    r.kind === k ? (k === 'BUSINESS' ? 'bg-violet-600 text-white' : 'bg-amber-500 text-white') : 'text-slate-500'
                  }`}
                >
                  {k === 'BUSINESS' ? 'In hand' : 'Savings'}
                </button>
              ))}
            </div>
            {rows.length > 1 && (
              <button type="button" onClick={() => setRows(rows.filter((_, j) => j !== i))} className="p-1 text-slate-400 hover:text-rose-600" title="Remove">
                <Trash2 className="h-4 w-4" />
              </button>
            )}
          </div>
        </div>
      ))}
      <button
        type="button"
        onClick={() => setRows([...rows, { personId: '', amount: left > 0 ? String(left) : '', kind: 'SAVINGS' }])}
        className="text-[11px] font-semibold text-teal-700 hover:underline"
      >
        + Split with someone else / another source
      </button>
      <p className="text-[10px] text-slate-400">
        <b>In hand</b> = paid from the business money that person holds (their In hand goes down). <b>Savings</b> = their own money put into the
        business (shown as an investment).
      </p>
    </div>
  )
}

const defaultPayRows = (people: Option[], total: number): PayRow[] => [
  { personId: people[0]?.id || '', amount: total ? String(Math.round(total * 100) / 100) : '', kind: 'BUSINESS' },
]

// ── Add item ──
function AddItemModal({ cats, sups, people, onClose, onDone }: { cats: Option[]; sups: Option[]; people: Option[]; onClose: () => void; onDone: () => void }) {
  const [f, setF] = useState({ name: '', categoryId: '', supplierId: '', salePrice: '', lowStockAt: '', qty: '', unitCost: '' })
  const total = (parseInt(f.qty, 10) || 0) * (parseFloat(f.unitCost) || 0)
  const [pay, setPay] = useState<PayRow[]>(defaultPayRows(people, 0))
  const [busy, setBusy] = useState(false)
  // keep the single payment row in step with the total
  useEffect(() => {
    setPay((rows) => (rows.length === 1 ? [{ ...rows[0], amount: total ? String(Math.round(total * 100) / 100) : '' }] : rows))
  }, [total])

  const save = async (e: React.FormEvent) => {
    e.preventDefault()
    setBusy(true)
    try {
      const qty = parseInt(f.qty, 10) || 0
      await send('/api/inventory', 'POST', {
        name: f.name,
        categoryId: f.categoryId || null,
        supplierId: f.supplierId || null,
        salePrice: f.salePrice,
        lowStockAt: f.lowStockAt,
        opening: qty > 0 ? { quantity: qty, unitCost: f.unitCost, payments: pay } : null,
      })
      toast.success(`${f.name} added to inventory`)
      onDone()
    } catch (err: any) {
      toast.error(err.message)
    } finally {
      setBusy(false)
    }
  }

  return (
    <Modal title="Add item to inventory" onClose={onClose} wide>
      <form onSubmit={save} className="space-y-3">
        <div className="grid sm:grid-cols-2 gap-3">
          <div className="sm:col-span-2">
            <label className={label}>Item name *</label>
            <input autoFocus value={f.name} onChange={(e) => setF({ ...f, name: e.target.value })} placeholder="e.g. Corolla 2018 top cover" className={input} />
          </div>
          <div>
            <label className={label}>Category</label>
            <select value={f.categoryId} onChange={(e) => setF({ ...f, categoryId: e.target.value })} className={input}>
              <option value="">—</option>
              {cats.map((c) => (
                <option key={c.id} value={c.id}>
                  {c.name}
                </option>
              ))}
            </select>
          </div>
          <div>
            <label className={label}>Usual supplier</label>
            <select value={f.supplierId} onChange={(e) => setF({ ...f, supplierId: e.target.value })} className={input}>
              <option value="">—</option>
              {sups.map((s) => (
                <option key={s.id} value={s.id}>
                  {s.name}
                </option>
              ))}
            </select>
          </div>
          <div>
            <label className={label}>Sale price (usual)</label>
            <input type="number" min="0" value={f.salePrice} onChange={(e) => setF({ ...f, salePrice: e.target.value })} placeholder="e.g. 2200" className={input} />
          </div>
          <div>
            <label className={label}>Warn when stock is at or below</label>
            <input type="number" min="0" value={f.lowStockAt} onChange={(e) => setF({ ...f, lowStockAt: e.target.value })} placeholder="e.g. 3" className={input} />
          </div>
        </div>

        <div className="rounded-xl border border-teal-200 bg-teal-50/40 p-3 space-y-3">
          <div className="text-xs font-bold text-teal-800">Opening stock (optional)</div>
          <div className="grid grid-cols-3 gap-2">
            <div>
              <label className={label}>Quantity</label>
              <input type="number" min="0" value={f.qty} onChange={(e) => setF({ ...f, qty: e.target.value })} placeholder="0" className={input} />
            </div>
            <div>
              <label className={label}>Buy price each</label>
              <input type="number" min="0" step="0.01" value={f.unitCost} onChange={(e) => setF({ ...f, unitCost: e.target.value })} placeholder="1200" className={input} />
            </div>
            <div>
              <label className={label}>Total</label>
              <div className="px-3 py-2 text-sm font-mono font-bold text-slate-800">{rs(total)}</div>
            </div>
          </div>
          {(parseInt(f.qty, 10) || 0) > 0 && <PaymentsEditor people={people} total={total} rows={pay} setRows={setPay} />}
        </div>

        <div className="flex justify-end gap-2">
          <button type="button" onClick={onClose} className="px-3 py-2 rounded-lg border border-slate-200 text-xs font-semibold text-slate-600">
            Cancel
          </button>
          <button type="submit" disabled={busy || !f.name.trim()} className="px-4 py-2 rounded-lg bg-teal-600 hover:bg-teal-700 text-white text-xs font-bold disabled:opacity-50">
            {busy ? 'Saving…' : 'Add item'}
          </button>
        </div>
      </form>
    </Modal>
  )
}

// ── Buy stock ──
function BuyModal({ item, sups, people, onClose, onDone }: { item: Item; sups: Option[]; people: Option[]; onClose: () => void; onDone: () => void }) {
  const [qty, setQty] = useState('')
  const [unitCost, setUnitCost] = useState(item.avgCost ? String(item.avgCost) : '')
  const [supplierId, setSupplierId] = useState(item.supplierId || '')
  const [note, setNote] = useState('')
  const total = (parseInt(qty, 10) || 0) * (parseFloat(unitCost) || 0)
  const [pay, setPay] = useState<PayRow[]>(defaultPayRows(people, 0))
  const [busy, setBusy] = useState(false)
  useEffect(() => {
    setPay((rows) => (rows.length === 1 ? [{ ...rows[0], amount: total ? String(Math.round(total * 100) / 100) : '' }] : rows))
  }, [total])
  const newAvg =
    (parseInt(qty, 10) || 0) > 0
      ? item.stockQty <= 0
        ? parseFloat(unitCost) || 0
        : (item.stockQty * item.avgCost + total) / (item.stockQty + (parseInt(qty, 10) || 0))
      : item.avgCost

  const save = async (e: React.FormEvent) => {
    e.preventDefault()
    setBusy(true)
    try {
      await send(`/api/inventory/${item.id}/purchase`, 'POST', { quantity: qty, unitCost, supplierId: supplierId || null, note, payments: pay })
      toast.success(`Bought ${qty} × ${item.name}`)
      onDone()
    } catch (err: any) {
      toast.error(err.message)
    } finally {
      setBusy(false)
    }
  }

  return (
    <Modal title={`Buy stock · ${item.name}`} onClose={onClose} wide>
      <form onSubmit={save} className="space-y-3">
        <p className="text-xs text-slate-500">
          In stock now: <b>{item.stockQty}</b> · average cost <b>{rs(item.avgCost)}</b>
        </p>
        <div className="grid grid-cols-2 sm:grid-cols-4 gap-2">
          <div>
            <label className={label}>Quantity *</label>
            <input autoFocus type="number" min="1" value={qty} onChange={(e) => setQty(e.target.value)} className={input} />
          </div>
          <div>
            <label className={label}>Buy price each *</label>
            <input type="number" min="0" step="0.01" value={unitCost} onChange={(e) => setUnitCost(e.target.value)} className={input} />
          </div>
          <div className="col-span-2">
            <label className={label}>Supplier</label>
            <select value={supplierId} onChange={(e) => setSupplierId(e.target.value)} className={input}>
              <option value="">—</option>
              {sups.map((s) => (
                <option key={s.id} value={s.id}>
                  {s.name}
                </option>
              ))}
            </select>
          </div>
        </div>
        <div className="flex flex-wrap gap-x-6 text-xs text-slate-600">
          <span>
            Total: <b className="font-mono">{rs(total)}</b>
          </span>
          <span>
            New average cost: <b className="font-mono">{rs(newAvg)}</b>
          </span>
          <span>
            Stock after: <b>{item.stockQty + (parseInt(qty, 10) || 0)}</b>
          </span>
        </div>
        <PaymentsEditor people={people} total={total} rows={pay} setRows={setPay} />
        <div>
          <label className={label}>Note</label>
          <input value={note} onChange={(e) => setNote(e.target.value)} placeholder="optional" className={input} />
        </div>
        <div className="flex justify-end gap-2">
          <button type="button" onClick={onClose} className="px-3 py-2 rounded-lg border border-slate-200 text-xs font-semibold text-slate-600">
            Cancel
          </button>
          <button type="submit" disabled={busy || !(parseInt(qty, 10) > 0)} className="px-4 py-2 rounded-lg bg-teal-600 hover:bg-teal-700 text-white text-xs font-bold disabled:opacity-50">
            {busy ? 'Saving…' : `Save purchase · ${rs(total)}`}
          </button>
        </div>
      </form>
    </Modal>
  )
}

// ── Adjust count ──
function AdjustModal({ item, onClose, onDone }: { item: Item; onClose: () => void; onDone: () => void }) {
  const [dir, setDir] = useState<'remove' | 'add'>('remove')
  const [qty, setQty] = useState('')
  const [reason, setReason] = useState('')
  const [busy, setBusy] = useState(false)
  const n = parseInt(qty, 10) || 0
  const save = async (e: React.FormEvent) => {
    e.preventDefault()
    setBusy(true)
    try {
      await send(`/api/inventory/${item.id}/adjust`, 'POST', { change: dir === 'add' ? n : -n, reason })
      toast.success('Stock corrected')
      onDone()
    } catch (err: any) {
      toast.error(err.message)
    } finally {
      setBusy(false)
    }
  }
  return (
    <Modal title={`Correct stock · ${item.name}`} onClose={onClose}>
      <form onSubmit={save} className="space-y-3">
        <p className="text-xs text-slate-500">
          For a recount, damaged or lost items. Money is not changed. In stock now: <b>{item.stockQty}</b>
        </p>
        <div className="flex gap-2">
          {(['remove', 'add'] as const).map((d) => (
            <button
              key={d}
              type="button"
              onClick={() => setDir(d)}
              className={`flex-1 rounded-lg border px-3 py-2 text-xs font-bold ${
                dir === d ? (d === 'remove' ? 'border-rose-300 bg-rose-50 text-rose-700' : 'border-emerald-300 bg-emerald-50 text-emerald-700') : 'border-slate-200 text-slate-500'
              }`}
            >
              {d === 'remove' ? '− Remove' : '+ Add'}
            </button>
          ))}
        </div>
        <div className="grid grid-cols-[100px_1fr] gap-2">
          <div>
            <label className={label}>How many</label>
            <input autoFocus type="number" min="1" value={qty} onChange={(e) => setQty(e.target.value)} className={input} />
          </div>
          <div>
            <label className={label}>Why *</label>
            <input value={reason} onChange={(e) => setReason(e.target.value)} placeholder="counted again / damaged / lost / gift" className={input} />
          </div>
        </div>
        <p className="text-xs text-slate-600">
          Stock after: <b>{item.stockQty + (dir === 'add' ? n : -n)}</b>
        </p>
        <div className="flex justify-end gap-2">
          <button type="button" onClick={onClose} className="px-3 py-2 rounded-lg border border-slate-200 text-xs font-semibold text-slate-600">
            Cancel
          </button>
          <button type="submit" disabled={busy || n <= 0 || !reason.trim()} className="px-4 py-2 rounded-lg bg-slate-800 text-white text-xs font-bold disabled:opacity-50">
            {busy ? 'Saving…' : 'Save'}
          </button>
        </div>
      </form>
    </Modal>
  )
}

// ── Edit item ──
function EditModal({ item, cats, sups, onClose, onDone }: { item: Item; cats: Option[]; sups: Option[]; onClose: () => void; onDone: () => void }) {
  const [f, setF] = useState({
    name: item.name,
    categoryId: item.categoryId || '',
    supplierId: item.supplierId || '',
    salePrice: item.salePrice != null ? String(item.salePrice) : '',
    lowStockAt: item.lowStockAt != null ? String(item.lowStockAt) : '',
  })
  const [busy, setBusy] = useState(false)
  const save = async (patch: Record<string, unknown>, msg: string) => {
    setBusy(true)
    try {
      await send(`/api/inventory/${item.id}`, 'PATCH', patch)
      toast.success(msg)
      onDone()
    } catch (err: any) {
      toast.error(err.message)
    } finally {
      setBusy(false)
    }
  }
  return (
    <Modal title={`Edit · ${item.name}`} onClose={onClose}>
      <form
        onSubmit={(e) => {
          e.preventDefault()
          save(f, 'Saved')
        }}
        className="space-y-3"
      >
        <div>
          <label className={label}>Item name</label>
          <input value={f.name} onChange={(e) => setF({ ...f, name: e.target.value })} className={input} />
        </div>
        <div className="grid grid-cols-2 gap-2">
          <div>
            <label className={label}>Category</label>
            <select value={f.categoryId} onChange={(e) => setF({ ...f, categoryId: e.target.value })} className={input}>
              <option value="">—</option>
              {cats.map((c) => (
                <option key={c.id} value={c.id}>
                  {c.name}
                </option>
              ))}
            </select>
          </div>
          <div>
            <label className={label}>Usual supplier</label>
            <select value={f.supplierId} onChange={(e) => setF({ ...f, supplierId: e.target.value })} className={input}>
              <option value="">—</option>
              {sups.map((s) => (
                <option key={s.id} value={s.id}>
                  {s.name}
                </option>
              ))}
            </select>
          </div>
          <div>
            <label className={label}>Sale price (usual)</label>
            <input type="number" min="0" value={f.salePrice} onChange={(e) => setF({ ...f, salePrice: e.target.value })} className={input} />
          </div>
          <div>
            <label className={label}>Warn at or below</label>
            <input type="number" min="0" value={f.lowStockAt} onChange={(e) => setF({ ...f, lowStockAt: e.target.value })} className={input} />
          </div>
        </div>
        <div className="flex items-center gap-2">
          <button
            type="button"
            disabled={busy}
            onClick={() => {
              if (confirm(item.active ? `Archive "${item.name}"? It will be hidden and cannot be picked in new orders.` : `Restore "${item.name}"?`))
                save({ active: !item.active }, item.active ? 'Archived' : 'Restored')
            }}
            className="flex items-center gap-1 px-3 py-2 rounded-lg border border-slate-200 text-xs font-semibold text-slate-500 hover:text-rose-600"
          >
            <Archive className="h-3.5 w-3.5" /> {item.active ? 'Archive' : 'Restore'}
          </button>
          <span className="flex-1" />
          <button type="button" onClick={onClose} className="px-3 py-2 rounded-lg border border-slate-200 text-xs font-semibold text-slate-600">
            Cancel
          </button>
          <button type="submit" disabled={busy || !f.name.trim()} className="px-4 py-2 rounded-lg bg-teal-600 text-white text-xs font-bold disabled:opacity-50">
            Save
          </button>
        </div>
      </form>
    </Modal>
  )
}

// ── Stock movements (one item, or all) ──
const ACTION_TONE: Record<string, string> = {
  stock_in: 'bg-emerald-100 text-emerald-700',
  sold: 'bg-violet-100 text-violet-700',
  released: 'bg-sky-100 text-sky-700',
  returned_back: 'bg-sky-100 text-sky-700',
  adjusted: 'bg-amber-100 text-amber-800',
  created: 'bg-slate-100 text-slate-600',
  edited: 'bg-slate-100 text-slate-600',
  archived: 'bg-slate-200 text-slate-700',
}
const ACTION_WORD: Record<string, string> = {
  stock_in: 'Bought',
  sold: 'Sold',
  released: 'Back',
  returned_back: 'Returned',
  adjusted: 'Adjusted',
  created: 'Added',
  edited: 'Edited',
  archived: 'Archived',
}

function MovementList({ itemId, showItem }: { itemId?: string; showItem?: boolean }) {
  const [logs, setLogs] = useState<LogLine[]>([])
  const [page, setPage] = useState(0)
  const [hasMore, setHasMore] = useState(false)
  const [loading, setLoading] = useState(true)
  const load = useCallback(
    async (p: number) => {
      setLoading(true)
      try {
        const d = await send(`/api/inventory/logs?page=${p}${itemId ? `&itemId=${itemId}` : ''}`, 'GET')
        setLogs((prev) => (p === 0 ? d.logs : [...prev, ...d.logs]))
        setHasMore(d.hasMore)
        setPage(p)
      } catch (e: any) {
        toast.error(e.message)
      } finally {
        setLoading(false)
      }
    },
    [itemId]
  )
  useEffect(() => {
    load(0)
  }, [load])

  return (
    <div>
      <ul className="divide-y divide-slate-100">
        {logs.map((l) => (
          <li key={l.id} className="flex gap-3 py-2.5">
            <span className={`h-fit shrink-0 rounded-md px-1.5 py-0.5 text-[10px] font-bold ${ACTION_TONE[l.action] || 'bg-slate-100 text-slate-600'}`}>
              {ACTION_WORD[l.action] || l.action}
            </span>
            <div className="min-w-0 flex-1">
              <div className="text-[13px] text-slate-800">
                {showItem && l.item && <b>{l.item.name}: </b>}
                {l.message}
              </div>
              <div className="text-[11px] text-slate-400">
                {new Date(l.createdAt).toLocaleString('en-GB', { day: 'numeric', month: 'short', year: 'numeric', hour: '2-digit', minute: '2-digit' })} ·{' '}
                <span className="font-semibold text-slate-500">{l.actor || l.source}</span>
              </div>
            </div>
            {l.qtyChange !== 0 && (
              <span className={`shrink-0 font-mono text-sm font-bold ${l.qtyChange > 0 ? 'text-emerald-600' : 'text-rose-600'}`}>
                {l.qtyChange > 0 ? '+' : ''}
                {l.qtyChange}
              </span>
            )}
          </li>
        ))}
      </ul>
      {loading && (
        <div className="flex justify-center py-4 text-slate-400">
          <Loader2 className="h-4 w-4 animate-spin" />
        </div>
      )}
      {!loading && logs.length === 0 && <p className="py-6 text-center text-sm text-slate-500">No stock movements yet.</p>}
      {!loading && hasMore && (
        <div className="py-2 text-center">
          <button onClick={() => load(page + 1)} className="rounded-lg border border-slate-200 px-3 py-1.5 text-xs font-semibold text-slate-600">
            Load more
          </button>
        </div>
      )}
    </div>
  )
}

// ── Page ──
export default function InventoryPage() {
  const [items, setItems] = useState<Item[]>([])
  const [cats, setCats] = useState<Option[]>([])
  const [sups, setSups] = useState<Option[]>([])
  const [people, setPeople] = useState<Option[]>([])
  const [loading, setLoading] = useState(true)
  const [search, setSearch] = useState('')
  const [tab, setTab] = useState<'items' | 'log'>('items')
  const [showArchived, setShowArchived] = useState(false)
  const [modal, setModal] = useState<{ kind: 'add' | 'buy' | 'adjust' | 'edit' | 'history'; item?: Item } | null>(null)

  const load = useCallback(async () => {
    setLoading(true)
    try {
      const [inv, c, s, p] = await Promise.all([
        send(`/api/inventory${showArchived ? '?archived=1' : ''}`, 'GET'),
        send('/api/categories', 'GET'),
        send('/api/suppliers', 'GET'),
        send('/api/people', 'GET'),
      ])
      setItems(inv)
      setCats(Array.isArray(c) ? c : [])
      setSups(Array.isArray(s) ? s : [])
      setPeople(Array.isArray(p) ? p : [])
    } catch (e: any) {
      toast.error(e.message)
    } finally {
      setLoading(false)
    }
  }, [showArchived])
  useEffect(() => {
    load()
  }, [load])

  const shown = useMemo(() => {
    const q = search.trim().toLowerCase()
    return items.filter((i) => !q || i.name.toLowerCase().includes(q) || i.category?.name.toLowerCase().includes(q))
  }, [items, search])

  const totals = useMemo(() => {
    const active = items.filter((i) => i.active)
    return {
      items: active.length,
      units: active.reduce((a, i) => a + i.stockQty, 0),
      value: active.reduce((a, i) => a + i.stockQty * i.avgCost, 0),
      low: active.filter((i) => i.stockQty > 0 && i.lowStockAt != null && i.stockQty <= i.lowStockAt).length,
      out: active.filter((i) => i.stockQty <= 0).length,
    }
  }, [items])

  const done = () => {
    setModal(null)
    load()
  }
  const badge = (i: Item) =>
    i.stockQty <= 0
      ? 'bg-rose-50 text-rose-700 border-rose-200'
      : i.lowStockAt != null && i.stockQty <= i.lowStockAt
      ? 'bg-amber-50 text-amber-700 border-amber-200'
      : 'bg-emerald-50 text-emerald-700 border-emerald-200'

  return (
    <div className="space-y-4">
      {/* Totals */}
      <div className="grid grid-cols-2 lg:grid-cols-4 gap-3">
        {[
          { label: 'Items in inventory', value: String(totals.items) },
          { label: 'Units in stock', value: totals.units.toLocaleString('en-PK') },
          { label: 'Stock value (at cost)', value: rs(totals.value) },
          { label: 'Low / out of stock', value: `${totals.low} / ${totals.out}` },
        ].map((c) => (
          <div key={c.label} className="rounded-2xl border border-slate-200 bg-white p-3 shadow-sm">
            <div className="text-[11px] text-slate-500">{c.label}</div>
            <div className="mt-1 font-mono text-lg font-black text-slate-900">{c.value}</div>
          </div>
        ))}
      </div>

      <div className="bg-white border border-slate-200 rounded-2xl shadow-sm">
        <div className="p-3 sm:p-4 border-b border-slate-100 flex flex-col md:flex-row md:items-center gap-2">
          <div className="flex items-center gap-1 bg-slate-100 rounded-xl p-1 w-fit">
            {(['items', 'log'] as const).map((t) => (
              <button
                key={t}
                onClick={() => setTab(t)}
                className={`px-3 py-1.5 rounded-lg text-xs font-semibold ${tab === t ? 'bg-white text-slate-900 shadow-sm' : 'text-slate-500'}`}
              >
                {t === 'items' ? 'Items' : 'All stock movements'}
              </button>
            ))}
          </div>
          {tab === 'items' && (
            <div className="flex items-center gap-2 md:ml-auto">
              <div className="relative flex-1 md:w-64">
                <Search className="absolute left-3 top-2.5 h-4 w-4 text-slate-400" />
                <input
                  value={search}
                  onChange={(e) => setSearch(e.target.value)}
                  placeholder="Search item or category…"
                  className="w-full bg-slate-50 border border-slate-200 rounded-xl pl-9 pr-3 py-2 text-xs focus:outline-none focus:border-teal-500 focus:bg-white"
                />
              </div>
              <label className="flex items-center gap-1 text-[11px] text-slate-500 whitespace-nowrap">
                <input type="checkbox" checked={showArchived} onChange={(e) => setShowArchived(e.target.checked)} className="accent-teal-600" /> Archived
              </label>
              <button
                onClick={() => setModal({ kind: 'add' })}
                className="shrink-0 flex items-center gap-1.5 px-3 py-2 rounded-xl bg-teal-600 hover:bg-teal-700 text-white text-xs font-bold"
              >
                <Plus className="h-4 w-4" /> Add item
              </button>
            </div>
          )}
        </div>

        {tab === 'log' ? (
          <div className="px-4 py-2">
            <MovementList showItem />
          </div>
        ) : (
          <>
            {loading && items.length === 0 ? (
              <div className="flex justify-center py-10 text-slate-400">
                <Loader2 className="h-5 w-5 animate-spin" />
              </div>
            ) : shown.length === 0 ? (
              <div className="py-12 text-center">
                <Boxes className="mx-auto h-8 w-8 text-slate-300" />
                <p className="mt-2 text-sm font-semibold text-slate-600">{items.length ? 'No item matches your search' : 'Inventory is empty'}</p>
                {!items.length && <p className="text-xs text-slate-400">Click “Add item” to add your first stock.</p>}
              </div>
            ) : (
              <div className="overflow-x-auto">
                <table className="w-full min-w-[820px] text-left text-xs text-slate-700">
                  <thead>
                    <tr className="bg-slate-50 text-[10px] text-slate-500 uppercase tracking-wider font-semibold border-b border-slate-200">
                      <th className="px-3 py-2.5">Item</th>
                      <th className="px-2 py-2.5">In stock</th>
                      <th className="px-2 py-2.5">Avg cost</th>
                      <th className="px-2 py-2.5">Sale price</th>
                      <th className="px-2 py-2.5">Stock value</th>
                      <th className="px-3 py-2.5 text-right">Actions</th>
                    </tr>
                  </thead>
                  <tbody>
                    {shown.map((i, idx) => (
                      <tr key={i.id} className={`border-b border-slate-200 last:border-b-0 ${idx % 2 ? 'bg-slate-100/80' : 'bg-white'} ${i.active ? '' : 'opacity-60'}`}>
                        <td className="px-3 py-2.5">
                          <div className="font-semibold text-slate-900">
                            {i.name} {!i.active && <span className="ml-1 rounded bg-slate-200 px-1 text-[10px]">archived</span>}
                          </div>
                          <div className="text-[11px] text-slate-400">{[i.category?.name, i.supplier?.name].filter(Boolean).join(' · ') || '—'}</div>
                        </td>
                        <td className="px-2 py-2.5">
                          <span className={`inline-flex rounded-full border px-2 py-0.5 text-[11px] font-bold ${badge(i)}`}>
                            {i.stockQty <= 0 ? 'Out of stock' : `${i.stockQty} left`}
                          </span>
                        </td>
                        <td className="px-2 py-2.5 font-mono">{rs(i.avgCost)}</td>
                        <td className="px-2 py-2.5 font-mono">{rs(i.salePrice)}</td>
                        <td className="px-2 py-2.5 font-mono font-semibold">{rs(i.stockQty * i.avgCost)}</td>
                        <td className="px-3 py-2.5">
                          <div className="flex justify-end gap-1.5">
                            <button
                              onClick={() => setModal({ kind: 'buy', item: i })}
                              disabled={!i.active}
                              className="flex items-center gap-1 rounded-lg bg-teal-50 border border-teal-200 px-2 py-1 text-[11px] font-semibold text-teal-700 hover:bg-teal-100 disabled:opacity-40"
                            >
                              <ShoppingBag className="h-3.5 w-3.5" /> Buy stock
                            </button>
                            <button onClick={() => setModal({ kind: 'adjust', item: i })} title="Correct the count" className="rounded-lg border border-slate-200 p-1.5 text-slate-500 hover:text-amber-700">
                              <SlidersHorizontal className="h-3.5 w-3.5" />
                            </button>
                            <button onClick={() => setModal({ kind: 'edit', item: i })} title="Edit" className="rounded-lg border border-slate-200 p-1.5 text-slate-500 hover:text-blue-700">
                              <Pencil className="h-3.5 w-3.5" />
                            </button>
                            <button onClick={() => setModal({ kind: 'history', item: i })} title="Stock history" className="rounded-lg border border-violet-200 bg-violet-50 p-1.5 text-violet-600 hover:bg-violet-100">
                              <History className="h-3.5 w-3.5" />
                            </button>
                          </div>
                        </td>
                      </tr>
                    ))}
                  </tbody>
                </table>
              </div>
            )}
          </>
        )}
      </div>

      {modal?.kind === 'add' && <AddItemModal cats={cats} sups={sups} people={people} onClose={() => setModal(null)} onDone={done} />}
      {modal?.kind === 'buy' && modal.item && <BuyModal item={modal.item} sups={sups} people={people} onClose={() => setModal(null)} onDone={done} />}
      {modal?.kind === 'adjust' && modal.item && <AdjustModal item={modal.item} onClose={() => setModal(null)} onDone={done} />}
      {modal?.kind === 'edit' && modal.item && <EditModal item={modal.item} cats={cats} sups={sups} onClose={() => setModal(null)} onDone={done} />}
      {modal?.kind === 'history' && modal.item && (
        <Modal title={`Stock history · ${modal.item.name}`} onClose={() => setModal(null)} wide>
          <div className="mb-2 flex gap-4 text-xs text-slate-500">
            <span className="flex items-center gap-1">
              <ArrowUpCircle className="h-3.5 w-3.5 text-emerald-500" /> in
            </span>
            <span className="flex items-center gap-1">
              <ArrowDownCircle className="h-3.5 w-3.5 text-rose-500" /> out
            </span>
            <span className="ml-auto">
              In stock now: <b>{modal.item.stockQty}</b>
            </span>
          </div>
          <MovementList itemId={modal.item.id} />
        </Modal>
      )}
    </div>
  )
}
