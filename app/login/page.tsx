import type { Metadata } from 'next'
import { PackageCheck, Wallet, MessageCircle } from 'lucide-react'
import LoginForm from './LoginForm'

const BUSINESS_NAME = process.env.BUSINESS_NAME || 'Fancy Store'
const STORE_TAGLINE = (process.env.STORE_TAGLINE || 'Car Accessories').trim()

export const metadata: Metadata = {
  title: `Log in · ${BUSINESS_NAME}`,
  robots: { index: false, follow: false },
}

const FEATURES = [
  { icon: PackageCheck, text: 'Orders, parcels and Leopards tracking' },
  { icon: Wallet, text: 'Payments, withdrawals and who holds the money' },
  { icon: MessageCircle, text: 'WhatsApp messages to customers' },
]

export default function LoginPage() {
  return (
    <main className="min-h-screen bg-gradient-to-b from-[#e9eef5] to-slate-50 lg:grid lg:grid-cols-2">
      {/* Brand panel (desktop) */}
      <section className="relative hidden lg:flex flex-col justify-between overflow-hidden bg-[#1d3557] p-12 text-white">
        <div className="pointer-events-none absolute -right-24 -top-24 h-80 w-80 rounded-full bg-white/5" />
        <div className="pointer-events-none absolute -bottom-32 -left-20 h-96 w-96 rounded-full bg-white/5" />

        <div className="relative">
          <div className="text-xs font-semibold uppercase tracking-[0.2em] text-slate-300">{BUSINESS_NAME}</div>
          <div className="text-xs text-slate-400">{STORE_TAGLINE}</div>
        </div>

        <div className="relative max-w-md">
          <h1 className="text-4xl font-black leading-tight">
            Run the whole store
            <br />
            from one place.
          </h1>
          <ul className="mt-8 space-y-4">
            {FEATURES.map(({ icon: Icon, text }) => (
              <li key={text} className="flex items-center gap-3 text-sm text-slate-200">
                <span className="flex h-9 w-9 shrink-0 items-center justify-center rounded-xl bg-white/10">
                  <Icon className="h-4 w-4" />
                </span>
                {text}
              </li>
            ))}
          </ul>
        </div>

        <div className="relative text-xs text-slate-400">
          © {new Date().getFullYear()} {BUSINESS_NAME} · Business Manager
        </div>
      </section>

      {/* Form */}
      <section className="flex min-h-screen items-center justify-center px-4 py-10 lg:min-h-0">
        <div className="w-full max-w-sm">
          <div className="mb-6 flex flex-col items-center text-center">
            {/* eslint-disable-next-line @next/next/no-img-element */}
            <img src="/logo.png" alt={BUSINESS_NAME} className="h-16 w-auto" />
            <p className="mt-1 text-xs text-slate-500">{STORE_TAGLINE}</p>
          </div>

          <div className="rounded-2xl border border-slate-200 bg-white p-6 shadow-sm">
            <h2 className="text-lg font-bold text-slate-900">Welcome back</h2>
            <p className="mb-5 text-xs text-slate-500">Log in to the {BUSINESS_NAME} Business Manager</p>
            <LoginForm />
          </div>

          <p className="mt-6 text-center text-[11px] text-slate-400">
            Only for the {BUSINESS_NAME} team. Forgot your password? Ask the admin to reset it.
          </p>
        </div>
      </section>
    </main>
  )
}
