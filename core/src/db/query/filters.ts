import type { Expression, ExpressionBuilder, SqlBool } from 'kysely'
import type { EpochMs } from '../../types.ts'
import type { DB } from '../schema.ts'

// Shared row scoping: hidden exclusion + month window.

/** user-hidden URLs are excluded from every query */
export function hiddenExcluded(eb: ExpressionBuilder<DB, 'urls'>): Expression<SqlBool> {
  return eb.not(
    eb.exists(
      eb.selectFrom('hidden_urls')
        .select('url_id')
        .whereRef('hidden_urls.url_id', '=', 'urls.id'),
    ),
  )
}

const MONTH_RE = /^\d{4}-(0[1-9]|1[0-2])$/

/** `YYYY-MM` → [start, end) epoch ms, local. */
export function monthRange(month: string): [EpochMs, EpochMs] {
  if (!MONTH_RE.test(month))
    throw new Error(`month: 'YYYY-MM' required, got ${month}`)
  const year = Number(month.slice(0, 4))
  const monthIndex = Number(month.slice(5)) - 1
  // setFullYear preserves years 0000-0099 instead of interpreting them as 1900-1999.
  const start = new Date(0)
  start.setFullYear(year, monthIndex, 1)
  start.setHours(0, 0, 0, 0)
  const end = new Date(0)
  end.setFullYear(year, monthIndex + 1, 1)
  end.setHours(0, 0, 0, 0)
  return [start.getTime(), end.getTime()]
}

// [start, end) visit-time predicate.
export function monthWindow(start: EpochMs, end: EpochMs) {
  return (eb: ExpressionBuilder<DB, 'visits'>): Expression<SqlBool> =>
    eb.and([
      eb('visits.visit_time', '>=', start),
      eb('visits.visit_time', '<', end),
    ])
}
