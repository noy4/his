import dayjs from 'dayjs'
import calendar from 'dayjs/plugin/calendar'

dayjs.extend(calendar)

const DATE_FORMAT = 'ddd, MMM D, YYYY'

// 1791039600000 → 'Sun, Oct 4, 2026'
export function dateLabel(epoch: number): string {
  return dayjs(epoch).format(DATE_FORMAT)
}

// → 'Today' · 'Yesterday' · 'Sun, Oct 4, 2026'
export function relativeDateLabel(epoch: number): string {
  return dayjs(epoch).calendar(undefined, {
    sameDay: '[Today]',
    lastDay: '[Yesterday]',
    nextDay: '[Tomorrow]',
    lastWeek: DATE_FORMAT,
    nextWeek: DATE_FORMAT,
    sameElse: DATE_FORMAT,
  })
}

// 1791039600000 → '12:00 AM'
export function timeLabel(epoch: number): string {
  return dayjs(epoch).format('h:mm A')
}

// 1791039600000 → '2026-10-04'
export function isoDay(epoch: number | null): string {
  return epoch === null ? '' : dayjs(epoch).format('YYYY-MM-DD')
}

// '2026-10-04' → 1791039600000
export function dayStartMs(iso: string): number | null {
  const d = dayjs(iso)
  return d.isValid() ? d.startOf('day').valueOf() : null
}

// '2026-10-04' → 1791125999999
export function dayEndMs(iso: string): number | null {
  const d = dayjs(iso)
  return d.isValid() ? d.endOf('day').valueOf() : null
}

const DAY_MS = 86_400_000

// → 'today' · 'yesterday' · '5d ago' · '3mo ago' · '2y ago' · null → '—'
export function relativeAgo(epoch: number | null): string {
  if (epoch === null || epoch === 0) return '—'
  const days = Math.floor((Date.now() - epoch) / DAY_MS)
  if (days <= 0) return 'today'
  if (days === 1) return 'yesterday'
  if (days < 30) return `${days}d ago`
  if (days < 365) return `${Math.floor(days / 30)}mo ago`
  return `${Math.floor(days / 365)}y ago`
}
