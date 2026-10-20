// Order date + time, e.g. "20 Oct 2026, 3:45 PM" (or "20 Oct, 3:45 PM" when short)
export const formatDateTime = (iso: string | Date, short = false) => {
  const d = new Date(iso)
  const date = d.toLocaleDateString('en-GB', { day: 'numeric', month: 'short', ...(short ? {} : { year: 'numeric' }) })
  const time = d.toLocaleTimeString('en-US', { hour: 'numeric', minute: '2-digit', hour12: true })
  return `${date}, ${time}`
}
