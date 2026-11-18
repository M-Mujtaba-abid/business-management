import type { Metadata } from 'next'
import prisma from '@/lib/prisma'
import { trackPacket, normalizeCN, isLeopardsCN, type Tracking } from '@/lib/leopards'

// Public page a customer opens from the WhatsApp dispatch message: /track/LE7549254868
// Only tracking numbers saved on one of our orders are looked up, so the page can't be used
// to track other people's parcels with our Leopards account.

export const dynamic = 'force-dynamic'

const BUSINESS_NAME = process.env.BUSINESS_NAME || 'Fancy Store'
const STORE_URL = (process.env.STORE_URL || 'https://fancystore.store').replace(/\/+$/, '')
const STORE_HOST = STORE_URL.replace(/^https?:\/\//, '')
const STORE_TAGLINE = process.env.STORE_TAGLINE || 'Car & bike covers, mats and headlight bulbs'
// Business WhatsApp number in international form, digits only (e.g. 923001234567)
const STORE_WHATSAPP = (process.env.BUSINESS_WHATSAPP || '923044456181').replace(/\D/g, '')
// Social pages: a button shows only when its link is set
const SOCIALS = [
  { name: 'Instagram', url: process.env.INSTAGRAM_URL || '', className: 'bg-gradient-to-r from-[#f58529] via-[#dd2a7b] to-[#8134af] text-white hover:opacity-90' },
  { name: 'Facebook', url: process.env.FACEBOOK_URL || '', className: 'bg-[#1877f2] text-white hover:opacity-90' },
  { name: 'TikTok', url: process.env.TIKTOK_URL || '', className: 'bg-black text-white hover:opacity-90' },
].filter((x) => /^https?:\/\//.test(x.url))

export const metadata: Metadata = {
  title: `Track your order · ${BUSINESS_NAME}`,
  robots: { index: false, follow: false },
}

const MONTHS = ['Jan', 'Feb', 'Mar', 'Apr', 'May', 'Jun', 'Jul', 'Aug', 'Sep', 'Oct', 'Nov', 'Dec']

// "2026-11-18" → "18 Nov 2026"
function niceDate(d: string) {
  const m = d.match(/^(\d{4})-(\d{2})-(\d{2})/)
  return m ? `${Number(m[3])} ${MONTHS[Number(m[2]) - 1] || m[2]} ${m[1]}` : d
}

// "17/11/2026" → "17 Nov 2026"
function niceBookedOn(d: string) {
  const m = d.match(/^(\d{1,2})\/(\d{1,2})\/(\d{2,4})$/)
  if (!m) return d
  const year = m[3].length === 2 ? `20${m[3]}` : m[3]
  return `${Number(m[1])} ${MONTHS[Number(m[2]) - 1] || m[2]} ${year}`
}

const titleCase = (s: string) => s.toLowerCase().replace(/\b\w/g, (c) => c.toUpperCase())

const STEPS = ['Picked up', 'Dispatched', 'In your city', 'Out for delivery', 'Delivered']

// How far the parcel has come (index into STEPS), or 'returned'
function progress(t: Tracking): number | 'returned' {
  const all = [t.status, ...t.events.map((e) => e.status)].join(' | ').toLowerCase()
  if (/return/.test(all)) return 'returned'
  let step = 0
  for (const e of t.events) {
    const s = e.status.toLowerCase()
    if (/deliver/.test(s) && !/out for deliver/.test(s)) step = Math.max(step, 4)
    else if (/out for deliver|assigned to courier|on route/.test(s)) step = Math.max(step, 3)
    else if (/arrived/.test(s)) step = Math.max(step, 2)
    else if (/dispatch/.test(s)) step = Math.max(step, 1)
  }
  if (/^delivered/.test(t.status.toLowerCase())) step = 4
  return step
}

const HEADLINES = [
  'Your parcel has been picked up',
  'Your parcel is on its way',
  'Your parcel has reached your city',
  'Your parcel is out for delivery',
  'Your parcel has been delivered',
]

function WhatsAppIcon({ className = '' }: { className?: string }) {
  return (
    <svg viewBox="0 0 24 24" fill="currentColor" aria-hidden="true" className={className}>
      <path d="M17.47 14.38c-.3-.15-1.75-.86-2.02-.96-.27-.1-.47-.15-.67.15-.2.3-.77.96-.94 1.16-.17.2-.35.22-.65.07-.3-.15-1.25-.46-2.38-1.47-.88-.79-1.47-1.76-1.65-2.06-.17-.3-.02-.46.13-.61.13-.13.3-.35.45-.52.15-.17.2-.3.3-.5.1-.2.05-.37-.03-.52-.07-.15-.67-1.62-.92-2.22-.24-.58-.49-.5-.67-.51h-.57c-.2 0-.52.07-.79.37-.27.3-1.04 1.02-1.04 2.48s1.07 2.88 1.21 3.08c.15.2 2.1 3.2 5.08 4.49.71.31 1.26.49 1.69.63.71.23 1.36.2 1.87.12.57-.09 1.75-.72 2-1.41.25-.69.25-1.29.17-1.41-.07-.12-.27-.2-.57-.35M12.05 21.5h-.01a9.4 9.4 0 0 1-4.79-1.31l-.34-.2-3.56.93.95-3.47-.22-.36a9.4 9.4 0 0 1-1.44-5.02c0-5.2 4.23-9.43 9.44-9.43a9.4 9.4 0 0 1 9.43 9.44c0 5.2-4.23 9.43-9.43 9.43m8.02-17.46A11.27 11.27 0 0 0 12.05.7C5.8.7.71 5.79.71 12.04c0 2 .52 3.95 1.52 5.67L.62 23.3l5.72-1.5a11.3 11.3 0 0 0 5.7 1.45h.01c6.25 0 11.34-5.09 11.34-11.34 0-3.03-1.18-5.88-3.32-8.02" />
    </svg>
  )
}

function Shell({ children }: { children: React.ReactNode }) {
  return (
    <main className="min-h-screen bg-gradient-to-b from-[#e9eef5] to-slate-50 px-4 pb-10 pt-6">
      <div className="mx-auto w-full max-w-md space-y-4">
        <header className="flex flex-col items-center gap-1 pb-1 text-center">
          <a href={STORE_URL} target="_blank" rel="noopener noreferrer" aria-label={`${BUSINESS_NAME} website`}>
            {/* eslint-disable-next-line @next/next/no-img-element */}
            <img src="/logo.png" alt={BUSINESS_NAME} className="h-16 w-auto" />
          </a>
          <p className="text-xs text-slate-500">{STORE_TAGLINE}</p>
        </header>

        {children}

        {/* Keep shopping */}
        <section className="overflow-hidden rounded-2xl bg-[#1d3557] p-5 text-white shadow-sm">
          <h2 className="text-base font-bold">Need something else for your ride? 🚗</h2>
          <p className="mt-1 text-sm text-slate-200">{STORE_TAGLINE}, all in one place.</p>
          <a
            href={STORE_URL}
            target="_blank"
            rel="noopener noreferrer"
            className="mt-4 flex w-full items-center justify-center rounded-xl bg-white px-4 py-3 text-sm font-bold text-[#1d3557] transition hover:bg-slate-100"
          >
            Shop more at {STORE_HOST} →
          </a>
        </section>

        {/* WhatsApp + social pages, side by side in one row */}
        {(STORE_WHATSAPP || SOCIALS.length > 0) && (
          <section className="rounded-2xl border border-slate-200 bg-white p-4 text-center shadow-sm">
            <p className="text-sm font-semibold text-slate-800">Questions, new arrivals & offers</p>
            <div className="mt-3 flex gap-2">
              {STORE_WHATSAPP && (
                <a
                  href={`https://wa.me/${STORE_WHATSAPP}`}
                  target="_blank"
                  rel="noopener noreferrer"
                  className="flex min-w-0 flex-1 items-center justify-center gap-1.5 rounded-xl bg-[#25d366] px-2 py-2.5 text-sm font-semibold text-white transition hover:opacity-90"
                >
                  <WhatsAppIcon className="h-4 w-4 shrink-0" /> <span className="truncate">WhatsApp</span>
                </a>
              )}
              {SOCIALS.map((x) => (
                <a
                  key={x.name}
                  href={x.url}
                  target="_blank"
                  rel="noopener noreferrer"
                  className={`flex min-w-0 flex-1 items-center justify-center rounded-xl px-2 py-2.5 text-sm font-semibold transition ${x.className}`}
                >
                  <span className="truncate">{x.name}</span>
                </a>
              ))}
            </div>
          </section>
        )}

        <footer className="pt-2 text-center text-[11px] text-slate-400">
          © {new Date().getFullYear()} {BUSINESS_NAME} ·{' '}
          <a href={STORE_URL} target="_blank" rel="noopener noreferrer" className="underline-offset-2 hover:underline">
            {STORE_HOST}
          </a>
        </footer>
      </div>
    </main>
  )
}

function Message({ title, text }: { title: string; text: string }) {
  return (
    <Shell>
      <section className="rounded-2xl border border-slate-200 bg-white p-6 text-center shadow-sm">
        <div className="text-3xl">📦</div>
        <h1 className="mt-2 text-base font-semibold text-slate-900">{title}</h1>
        <p className="mt-1 text-sm text-slate-500">{text}</p>
      </section>
    </Shell>
  )
}

export default async function TrackPage({ params }: { params: { cn: string } }) {
  const cn = normalizeCN(decodeURIComponent(params.cn || ''))

  const known =
    isLeopardsCN(cn) &&
    (await prisma.sale
      .findFirst({ where: { trackingNumber: { equals: cn, mode: 'insensitive' } }, select: { id: true } })
      .catch(() => null))
  if (!known) {
    return <Message title="Tracking number not found" text="Please check the link, or message us on WhatsApp." />
  }

  const result = await trackPacket(cn)
  if (!result.ok) {
    return result.reason === 'not-found' ? (
      <Message title={`Parcel ${cn}`} text="Leopards has no updates for this parcel yet. Please check again in a few hours." />
    ) : (
      <Message title={`Parcel ${cn}`} text="Tracking is not available right now. Please try again in a little while." />
    )
  }

  const t = result.tracking
  const p = progress(t)
  const returned = p === 'returned'
  const step = returned ? -1 : p
  const latest = t.events[0]
  const delivered = step === 4

  return (
    <Shell>
      <section className="rounded-2xl border border-slate-200 bg-white p-5 shadow-sm space-y-5">
        <div className="flex items-start justify-between gap-3">
          <div className="min-w-0">
            <div className="text-[11px] font-semibold uppercase tracking-wider text-slate-400">Leopards Courier</div>
            <div className="font-mono text-sm text-slate-700">{t.cn}</div>
          </div>
          <span
            className={`shrink-0 rounded-full px-3 py-1 text-xs font-bold ${
              returned ? 'bg-rose-100 text-rose-700' : delivered ? 'bg-emerald-100 text-emerald-700' : 'bg-[#1d3557]/10 text-[#1d3557]'
            }`}
          >
            {returned ? 'Returned' : STEPS[step]}
          </span>
        </div>

        <div>
          <h1 className="text-xl font-bold text-slate-900">
            {returned ? 'This parcel is being returned' : `${HEADLINES[step]}${delivered ? ' 🎉' : ''}`}
          </h1>
          {latest && (
            <p className="mt-0.5 text-sm text-slate-500">
              {latest.status} · {niceDate(latest.date)}
              {latest.time ? `, ${latest.time}` : ''}
            </p>
          )}
        </div>

        {/* Progress */}
        {!returned && (
          <div>
            <div className="flex items-center">
              {STEPS.map((_, i) => (
                <div key={i} className={`flex items-center ${i < STEPS.length - 1 ? 'flex-1' : ''}`}>
                  <span
                    className={`flex h-6 w-6 shrink-0 items-center justify-center rounded-full text-[11px] font-bold ${
                      i <= step ? (delivered ? 'bg-emerald-500 text-white' : 'bg-[#1d3557] text-white') : 'bg-slate-200 text-slate-500'
                    } ${i === step && !delivered ? 'ring-4 ring-[#1d3557]/15' : ''}`}
                  >
                    {i < step || delivered ? '✓' : i + 1}
                  </span>
                  {i < STEPS.length - 1 && (
                    <span className={`mx-1 h-1 flex-1 rounded-full ${i < step ? (delivered ? 'bg-emerald-500' : 'bg-[#1d3557]') : 'bg-slate-200'}`} />
                  )}
                </div>
              ))}
            </div>
            <div className="mt-1.5 flex justify-between text-[10px] leading-tight text-slate-500">
              {STEPS.map((s, i) => (
                <span key={s} className={`w-14 ${i === 0 ? 'text-left' : i === STEPS.length - 1 ? 'text-right' : 'text-center'} ${i === step ? 'font-semibold text-slate-800' : ''}`}>
                  {s}
                </span>
              ))}
            </div>
          </div>
        )}

        {(t.origin || t.destination) && (
          <div className="flex items-center gap-2 rounded-xl bg-slate-50 px-3 py-2.5 text-sm">
            <span className="font-semibold text-slate-700">{titleCase(t.origin) || '—'}</span>
            <span className="text-slate-400">→</span>
            <span className="font-semibold text-slate-700">{titleCase(t.destination) || '—'}</span>
            {t.bookedOn && <span className="ml-auto text-xs text-slate-400">Booked {niceBookedOn(t.bookedOn)}</span>}
          </div>
        )}

        {delivered && <p className="text-sm text-slate-600">Thank you for shopping with {BUSINESS_NAME}! We hope you love it. 💙</p>}
      </section>

      {t.events.length > 0 && (
        <section className="rounded-2xl border border-slate-200 bg-white p-5 shadow-sm">
          <h2 className="mb-3 text-xs font-semibold uppercase tracking-wider text-slate-500">Parcel history</h2>
          <ol className="relative space-y-4">
            <span className="absolute bottom-2 left-[4.5px] top-2 w-px bg-slate-200" aria-hidden="true" />
            {t.events.map((e, i) => (
              <li key={i} className="relative flex gap-3">
                <span
                  className={`relative mt-1.5 h-2.5 w-2.5 shrink-0 rounded-full ${
                    i === 0 ? (delivered ? 'bg-emerald-500' : returned ? 'bg-rose-500' : 'bg-[#1d3557]') : 'bg-slate-300'
                  }`}
                />
                <div className="min-w-0">
                  <div className={`text-sm ${i === 0 ? 'font-semibold text-slate-900' : 'text-slate-700'}`}>{e.status}</div>
                  <div className="text-xs text-slate-500">
                    {niceDate(e.date)}
                    {e.time ? `, ${e.time}` : ''}
                  </div>
                </div>
              </li>
            ))}
          </ol>
          <p className="mt-4 text-[11px] text-slate-400">Updates come from Leopards Courier and may take a few hours to appear.</p>
        </section>
      )}
    </Shell>
  )
}
