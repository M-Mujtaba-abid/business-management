'use client'

import { useState } from 'react'
import { Eye, EyeOff, Mail, Lock, Loader2 } from 'lucide-react'

const fieldClass =
  'w-full rounded-xl border border-slate-300 bg-white py-2.5 pl-10 text-sm text-slate-800 placeholder:text-slate-400 focus:border-[#1d3557] focus:outline-none focus:ring-2 focus:ring-[#1d3557]/15'

export default function LoginForm() {
  const [email, setEmail] = useState('')
  const [password, setPassword] = useState('')
  const [showPassword, setShowPassword] = useState(false)
  const [error, setError] = useState('')
  const [busy, setBusy] = useState(false)

  const submit = async (e: React.FormEvent) => {
    e.preventDefault()
    setBusy(true)
    setError('')
    try {
      const res = await fetch('/api/auth/login', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ email, password }),
      })
      if (!res.ok) throw new Error((await res.json().catch(() => ({}))).error || 'Login failed')
      // Only go back to a page on this site
      const next = new URLSearchParams(window.location.search).get('next') || '/'
      window.location.href = next.startsWith('/') && !next.startsWith('//') ? next : '/'
    } catch (err: any) {
      setError(err.message || 'Login failed')
      setBusy(false)
    }
  }

  return (
    <form onSubmit={submit} className="space-y-4">
      <label className="block">
        <span className="mb-1 block text-xs font-semibold text-slate-600">Email</span>
        <span className="relative block">
          <Mail className="pointer-events-none absolute left-3 top-1/2 h-4 w-4 -translate-y-1/2 text-slate-400" />
          <input
            type="email"
            autoFocus
            autoComplete="username"
            value={email}
            onChange={(e) => setEmail(e.target.value)}
            placeholder="you@example.com"
            className={`${fieldClass} pr-3`}
          />
        </span>
      </label>

      <label className="block">
        <span className="mb-1 block text-xs font-semibold text-slate-600">Password</span>
        <span className="relative block">
          <Lock className="pointer-events-none absolute left-3 top-1/2 h-4 w-4 -translate-y-1/2 text-slate-400" />
          <input
            type={showPassword ? 'text' : 'password'}
            autoComplete="current-password"
            value={password}
            onChange={(e) => setPassword(e.target.value)}
            placeholder="Your password"
            className={`${fieldClass} pr-11`}
          />
          <button
            type="button"
            onClick={() => setShowPassword((v) => !v)}
            aria-label={showPassword ? 'Hide password' : 'Show password'}
            title={showPassword ? 'Hide password' : 'Show password'}
            className="absolute right-1.5 top-1/2 -translate-y-1/2 rounded-lg p-2 text-slate-400 transition hover:bg-slate-100 hover:text-slate-700"
          >
            {showPassword ? <EyeOff className="h-4 w-4" /> : <Eye className="h-4 w-4" />}
          </button>
        </span>
      </label>

      {error && (
        <p role="alert" className="rounded-lg border border-rose-200 bg-rose-50 px-3 py-2 text-sm text-rose-700">
          {error}
        </p>
      )}

      <button
        type="submit"
        disabled={busy || !email || !password}
        className="flex w-full items-center justify-center gap-2 rounded-xl bg-[#1d3557] py-2.5 text-sm font-bold text-white transition hover:bg-[#16294a] disabled:opacity-50"
      >
        {busy && <Loader2 className="h-4 w-4 animate-spin" />}
        {busy ? 'Logging in…' : 'Log in'}
      </button>
    </form>
  )
}
