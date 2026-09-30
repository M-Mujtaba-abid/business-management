// Turns the dashboard's date params (range / startDate / endDate) into a { gte, lte } filter.
// range: all | today | week | month | YYYY-MM | YYYY ; startDate / endDate (YYYY-MM-DD) win over range.
export interface DateFilter {
  gte?: Date
  lte?: Date
}

export function parseDateRange(searchParams: URLSearchParams): DateFilter {
  const startDate = searchParams.get('startDate')
  const endDate = searchParams.get('endDate')
  const range = searchParams.get('range') || 'all'
  const now = new Date()

  if (startDate || endDate) {
    const filter: DateFilter = {}
    if (startDate) {
      const [y, m, d] = startDate.split('-').map(Number)
      filter.gte = new Date(y, m - 1, d, 0, 0, 0, 0)
    }
    if (endDate) {
      const [y, m, d] = endDate.split('-').map(Number)
      filter.lte = new Date(y, m - 1, d, 23, 59, 59, 999)
    }
    return filter
  }

  if (range === 'today') {
    return {
      gte: new Date(now.getFullYear(), now.getMonth(), now.getDate(), 0, 0, 0, 0),
      lte: new Date(now.getFullYear(), now.getMonth(), now.getDate(), 23, 59, 59, 999),
    }
  }
  if (range === 'week') {
    const start = new Date(now)
    start.setDate(now.getDate() - now.getDay())
    start.setHours(0, 0, 0, 0)
    return { gte: start }
  }
  if (range === 'month') {
    return { gte: new Date(now.getFullYear(), now.getMonth(), 1, 0, 0, 0, 0) }
  }
  if (/^\d{4}-\d{2}$/.test(range)) {
    const [y, m] = range.split('-').map(Number)
    return { gte: new Date(y, m - 1, 1, 0, 0, 0, 0), lte: new Date(y, m, 0, 23, 59, 59, 999) }
  }
  if (/^\d{4}$/.test(range)) {
    const y = parseInt(range, 10)
    return { gte: new Date(y, 0, 1, 0, 0, 0, 0), lte: new Date(y, 11, 31, 23, 59, 59, 999) }
  }
  return {}
}

export const hasBounds = (f: DateFilter) => Boolean(f.gte || f.lte)
