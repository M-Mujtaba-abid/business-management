'use client'

import React, { useCallback, useEffect, useState } from 'react'
import { Users, UserPlus, KeyRound, Trash2, X, Eye, EyeOff } from 'lucide-react'
import { toast } from 'sonner'

interface AppUser {
  id: string
  name: string
  email: string
  lastLoginAt: string | null
  isMe: boolean
}

const inputClass =
  'w-full bg-white border border-slate-300 rounded-lg px-3 py-2 text-sm text-slate-800 focus:outline-none focus:border-violet-500'

// Password box with a show / hide eye
function PasswordInput(props: { value: string; onChange: (v: string) => void; placeholder: string; autoFocus?: boolean }) {
  const [show, setShow] = useState(false)
  return (
    <span className="relative block w-full">
      <input
        className={`${inputClass} pr-10`}
        type={show ? 'text' : 'password'}
        autoComplete="new-password"
        autoFocus={props.autoFocus}
        placeholder={props.placeholder}
        value={props.value}
        onChange={(e) => props.onChange(e.target.value)}
      />
      <button
        type="button"
        onClick={() => setShow((v) => !v)}
        aria-label={show ? 'Hide password' : 'Show password'}
        title={show ? 'Hide password' : 'Show password'}
        className="absolute right-1 top-1/2 -translate-y-1/2 p-1.5 rounded-md text-slate-400 hover:text-slate-700"
      >
        {show ? <EyeOff className="h-4 w-4" /> : <Eye className="h-4 w-4" />}
      </button>
    </span>
  )
}

// Settings → Users: who can log in. Add a user, change a password, remove a user.
export default function UsersSettings() {
  const [users, setUsers] = useState<AppUser[]>([])
  const [loading, setLoading] = useState(true)
  const [adding, setAdding] = useState(false)
  const [form, setForm] = useState({ name: '', email: '', password: '' })
  const [pwFor, setPwFor] = useState<string | null>(null)
  const [newPw, setNewPw] = useState('')
  const [busy, setBusy] = useState(false)

  const load = useCallback(() => {
    setLoading(true)
    fetch('/api/users')
      .then((r) => r.json())
      .then((d) => Array.isArray(d) && setUsers(d))
      .finally(() => setLoading(false))
  }, [])
  useEffect(load, [load])

  const send = async (url: string, method: string, body?: unknown) => {
    const res = await fetch(url, {
      method,
      headers: { 'Content-Type': 'application/json' },
      body: body ? JSON.stringify(body) : undefined,
    })
    const data = await res.json().catch(() => ({}))
    if (!res.ok) throw new Error(data.error || 'Something went wrong')
    return data
  }

  const addUser = async (e: React.FormEvent) => {
    e.preventDefault()
    setBusy(true)
    try {
      await send('/api/users', 'POST', form)
      toast.success(`${form.name} can now log in`)
      setForm({ name: '', email: '', password: '' })
      setAdding(false)
      load()
    } catch (err: any) {
      toast.error(err.message)
    } finally {
      setBusy(false)
    }
  }

  const changePassword = async (e: React.FormEvent, u: AppUser) => {
    e.preventDefault()
    setBusy(true)
    try {
      await send(`/api/users/${u.id}`, 'PATCH', { password: newPw })
      toast.success(`Password changed for ${u.name}`)
      setPwFor(null)
      setNewPw('')
    } catch (err: any) {
      toast.error(err.message)
    } finally {
      setBusy(false)
    }
  }

  const removeUser = async (u: AppUser) => {
    if (!confirm(`Remove ${u.name} (${u.email})? They will not be able to log in any more.`)) return
    try {
      await send(`/api/users/${u.id}`, 'DELETE')
      toast.success(`${u.name} removed`)
      load()
    } catch (err: any) {
      toast.error(err.message)
    }
  }

  return (
    <section className="rounded-2xl border border-slate-200 bg-white shadow-sm overflow-hidden">
      <div className="flex items-center gap-3 px-4 py-3 border-b border-slate-100">
        <div className="h-9 w-9 rounded-xl bg-violet-50 border border-violet-200 text-violet-700 flex items-center justify-center shrink-0">
          <Users className="h-4 w-4" />
        </div>
        <div className="flex-1 min-w-0">
          <h2 className="text-sm font-bold text-slate-900">Users</h2>
          <p className="text-xs text-slate-500">People who can log in to this app</p>
        </div>
        <button
          onClick={() => setAdding((v) => !v)}
          className="flex items-center gap-1.5 px-3 py-2 rounded-lg bg-violet-600 hover:bg-violet-700 text-white text-xs font-bold"
        >
          <UserPlus className="h-4 w-4" /> Add user
        </button>
      </div>

      {adding && (
        <form onSubmit={addUser} className="p-4 border-b border-slate-100 bg-violet-50/40 grid gap-2 sm:grid-cols-3">
          <input className={inputClass} placeholder="Name" value={form.name} onChange={(e) => setForm({ ...form, name: e.target.value })} />
          <input className={inputClass} type="email" autoComplete="off" placeholder="Email" value={form.email} onChange={(e) => setForm({ ...form, email: e.target.value })} />
          <PasswordInput placeholder="Password (min 8)" value={form.password} onChange={(v) => setForm({ ...form, password: v })} />
          <div className="sm:col-span-3 flex justify-end gap-2">
            <button type="button" onClick={() => setAdding(false)} className="px-3 py-2 rounded-lg border border-slate-200 text-xs font-semibold text-slate-600">
              Cancel
            </button>
            <button type="submit" disabled={busy} className="px-3 py-2 rounded-lg bg-violet-600 hover:bg-violet-700 text-white text-xs font-bold disabled:opacity-50">
              {busy ? 'Saving…' : 'Save user'}
            </button>
          </div>
        </form>
      )}

      <ul className="divide-y divide-slate-100">
        {loading && users.length === 0 && <li className="px-4 py-3 text-xs text-slate-500">Loading…</li>}
        {users.map((u) => (
          <li key={u.id} className="px-4 py-3">
            <div className="flex items-center gap-3">
              <div className="flex-1 min-w-0">
                <div className="text-sm font-semibold text-slate-800 truncate">
                  {u.name} {u.isMe && <span className="ml-1 text-[10px] font-bold text-violet-700 bg-violet-50 border border-violet-200 rounded px-1.5 py-0.5">You</span>}
                </div>
                <div className="text-xs text-slate-500 truncate">{u.email}</div>
                <div className="text-[11px] text-slate-400">
                  {u.lastLoginAt ? `Last login ${new Date(u.lastLoginAt).toLocaleString()}` : 'Never logged in'}
                </div>
              </div>
              <button
                onClick={() => {
                  setPwFor(pwFor === u.id ? null : u.id)
                  setNewPw('')
                }}
                title="Change password"
                className="p-2 rounded-lg border border-slate-200 text-slate-500 hover:text-violet-700 hover:border-violet-200"
              >
                <KeyRound className="h-4 w-4" />
              </button>
              {!u.isMe && (
                <button
                  onClick={() => removeUser(u)}
                  title="Remove user"
                  className="p-2 rounded-lg border border-slate-200 text-slate-500 hover:text-rose-600 hover:border-rose-200"
                >
                  <Trash2 className="h-4 w-4" />
                </button>
              )}
            </div>
            {pwFor === u.id && (
              <form onSubmit={(e) => changePassword(e, u)} className="mt-2 flex gap-2">
                <PasswordInput
                  autoFocus
                  placeholder={`New password for ${u.name} (min 8)`}
                  value={newPw}
                  onChange={setNewPw}
                />
                <button type="submit" disabled={busy || !newPw} className="px-3 py-2 rounded-lg bg-violet-600 text-white text-xs font-bold disabled:opacity-50 shrink-0">
                  Save
                </button>
                <button type="button" onClick={() => setPwFor(null)} className="p-2 text-slate-400 hover:text-slate-700">
                  <X className="h-4 w-4" />
                </button>
              </form>
            )}
          </li>
        ))}
      </ul>
    </section>
  )
}
