import { sql, type Expression, type ExpressionBuilder, type SqlBool } from 'kysely'
import type { EpochMs } from '../types.ts'
import { hiddenExcluded } from './query.ts'
import type { KyselyDb } from './db.ts'
import type { DB } from './schema.ts'

// Dashboard aggregates; shape mirrors the WebUI Stats 1:1.
// Buckets use server-local time, days 'YYYY-MM-DD'; month ('YYYY-MM') scopes
// everything to that calendar month (totals count URLs visited in it).

export interface StatTotals {
  items: number
  visits: number
  domains: number
  firstVisit: EpochMs
  lastVisit: EpochMs
}

export interface Stats {
  totals: StatTotals
  byHour: { hour: number; visits: number }[]
  byDow: { dow: number; visits: number }[]
  topDomains: { domain: string; visits: number }[]
  busiestDays: { day: string; visits: number }[]
}

const MONTH_RE = /^\d{4}-(0[1-9]|1[0-2])$/

/** Returns local month boundaries as epoch ms: [inclusive start, exclusive end]. */
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

// Shared visit-time window predicate: [inclusive start, exclusive end).
export function monthWindow(start: EpochMs, end: EpochMs) {
  return (eb: ExpressionBuilder<DB, 'visits'>): Expression<SqlBool> =>
    eb.and([
      eb('visits.visit_time', '>=', start),
      eb('visits.visit_time', '<', end),
    ])
}

// time bucketing uses plain SQL.
export async function stats(db: KyselyDb, month?: string): Promise<Stats> {
  return month === undefined
    ? allTimeStats(db)
    : monthStats(db, month)
}

// --- implementation ---

async function allTimeStats(db: KyselyDb): Promise<Stats> {
  const rows = await db
    .selectFrom('urls')
    .select(['url', 'visit_count', 'first_visit_time', 'last_visit_time'])
    .where(hiddenExcluded)
    .execute()

  const byDomain = new Map<string, number>()
  let visits = 0
  let firstVisit = 0
  let lastVisit = 0
  for (const row of rows) {
    visits += row.visit_count
    firstVisit = firstVisit === 0 || row.first_visit_time < firstVisit ? row.first_visit_time : firstVisit
    lastVisit = row.last_visit_time > lastVisit ? row.last_visit_time : lastVisit
    const host = hostOf(row.url)
    byDomain.set(host, (byDomain.get(host) ?? 0) + row.visit_count)
  }
  const totals: StatTotals = {
    items: rows.length,
    visits,
    domains: byDomain.size,
    firstVisit,
    lastVisit,
  }

  const byHour = Array.from({ length: 24 }, () => 0)
  for (const bucket of await db
    .selectFrom('visits')
    .innerJoin('urls', 'urls.id', 'visits.url_id')
    .select((eb) => [
      sql<string>`strftime('%H', visit_time / 1000, 'unixepoch', 'localtime')`.as('hour'),
      eb.fn.countAll().as('visits'),
    ])
    .where(hiddenExcluded)
    .groupBy(sql`hour`)
    .execute()) {
    byHour[Number(bucket.hour)] = Number(bucket.visits)
  }

  const byDow = Array.from({ length: 7 }, () => 0)
  for (const bucket of await db
    .selectFrom('visits')
    .innerJoin('urls', 'urls.id', 'visits.url_id')
    .select((eb) => [
      sql<string>`strftime('%w', visit_time / 1000, 'unixepoch', 'localtime')`.as('dow'),
      eb.fn.countAll().as('visits'),
    ])
    .where(hiddenExcluded)
    .groupBy(sql`dow`)
    .execute()) {
    byDow[Number(bucket.dow)] = Number(bucket.visits)
  }

  const busiestDays = (await db
    .selectFrom('visits')
    .innerJoin('urls', 'urls.id', 'visits.url_id')
    .select((eb) => [
      sql<string>`DATE(visit_time / 1000, 'unixepoch', 'localtime')`.as('day'),
      eb.fn.countAll().as('visits'),
    ])
    .where(hiddenExcluded)
    .groupBy(sql`day`)
    .orderBy(sql`visits`, 'desc')
    .orderBy(sql`day`)
    .limit(5)
    .execute()).map((row) => ({ day: row.day, visits: Number(row.visits) }))

  return {
    totals,
    byHour: byHour.map((v, hour) => ({ hour, visits: v })),
    byDow: byDow.map((v, dow) => ({ dow, visits: v })),
    topDomains: topN(byDomain, 8),
    busiestDays,
  }
}

async function monthStats(db: KyselyDb, month: string): Promise<Stats> {
  const [start, end] = monthRange(month)
  const urlGroups = await db
    .selectFrom('visits')
    .innerJoin('urls', 'urls.id', 'visits.url_id')
    .select((eb) => [
      'urls.url as url',
      eb.fn.countAll().as('visits'),
      eb.fn.min('visits.visit_time').as('first_visit_time'),
      eb.fn.max('visits.visit_time').as('last_visit_time'),
    ])
    .where(monthWindow(start, end))
    .where(hiddenExcluded)
    .groupBy('urls.url')
    .execute()

  const byDomain = new Map<string, number>()
  let visits = 0
  let firstVisit = 0
  let lastVisit = 0
  for (const row of urlGroups) {
    const groupVisits = Number(row.visits)
    visits += groupVisits
    firstVisit = firstVisit === 0 || row.first_visit_time < firstVisit ? row.first_visit_time : firstVisit
    lastVisit = row.last_visit_time > lastVisit ? row.last_visit_time : lastVisit
    const host = hostOf(row.url)
    byDomain.set(host, (byDomain.get(host) ?? 0) + groupVisits)
  }
  const totals: StatTotals = {
    items: urlGroups.length,
    visits,
    domains: byDomain.size,
    firstVisit,
    lastVisit,
  }

  const byHour = Array.from({ length: 24 }, () => 0)
  for (const bucket of await db
    .selectFrom('visits')
    .innerJoin('urls', 'urls.id', 'visits.url_id')
    .select((eb) => [
      sql<string>`strftime('%H', visit_time / 1000, 'unixepoch', 'localtime')`.as('hour'),
      eb.fn.countAll().as('visits'),
    ])
    .where(monthWindow(start, end))
    .where(hiddenExcluded)
    .groupBy(sql`hour`)
    .execute()) {
    byHour[Number(bucket.hour)] = Number(bucket.visits)
  }

  const byDow = Array.from({ length: 7 }, () => 0)
  for (const bucket of await db
    .selectFrom('visits')
    .innerJoin('urls', 'urls.id', 'visits.url_id')
    .select((eb) => [
      sql<string>`strftime('%w', visit_time / 1000, 'unixepoch', 'localtime')`.as('dow'),
      eb.fn.countAll().as('visits'),
    ])
    .where(monthWindow(start, end))
    .where(hiddenExcluded)
    .groupBy(sql`dow`)
    .execute()) {
    byDow[Number(bucket.dow)] = Number(bucket.visits)
  }

  const busiestDays = (await db
    .selectFrom('visits')
    .innerJoin('urls', 'urls.id', 'visits.url_id')
    .select((eb) => [
      sql<string>`DATE(visit_time / 1000, 'unixepoch', 'localtime')`.as('day'),
      eb.fn.countAll().as('visits'),
    ])
    .where(monthWindow(start, end))
    .where(hiddenExcluded)
    .groupBy(sql`day`)
    .orderBy(sql`visits`, 'desc')
    .orderBy(sql`day`)
    .limit(5)
    .execute()).map((row) => ({ day: row.day, visits: Number(row.visits) }))

  return {
    totals,
    byHour: byHour.map((v, hour) => ({ hour, visits: v })),
    byDow: byDow.map((v, dow) => ({ dow, visits: v })),
    topDomains: topN(byDomain, 8),
    busiestDays,
  }
}

// --- helpers ---

function hostOf(url: string): string {
  try {
    return new URL(url).hostname.replace(/^www\./, '') || url
  } catch {
    return url
  }
}

function topN(map: Map<string, number>, n: number): { domain: string; visits: number }[] {
  return [...map]
    .sort((a, b) => b[1] - a[1] || a[0].localeCompare(b[0]))
    .slice(0, n)
    .map(([domain, visits]) => ({ domain, visits }))
}
