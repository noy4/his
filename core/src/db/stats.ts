import type { DatabaseSync } from 'node:sqlite'
import type { EpochMs } from '../model.ts'

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
export const MONTH_RANGE = 'visits.visit_time >= ? AND visits.visit_time < ?'

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

export function stats(db: DatabaseSync, month?: string): Stats {
  if (month === undefined) return allTimeStats(db)
  return monthStats(db, month)
}

// --- implementation ---

interface UrlRow {
  url: string
  visit_count: number
  first_visit_time: number
  last_visit_time: number
}

interface MonthUrlRow {
  url: string
  visits: number | bigint
  first_visit_time: number
  last_visit_time: number
}

interface HourRow {
  hour: string
  visits: number | bigint
}

interface DowRow {
  dow: string
  visits: number | bigint
}

interface DayRow {
  day: string
  visits: number | bigint
}

function allTimeStats(db: DatabaseSync): Stats {
  const rows = db
    .prepare('SELECT url, visit_count, first_visit_time, last_visit_time FROM urls')
    .all() as unknown as UrlRow[]

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
  for (const bucket of db.prepare(
    `SELECT strftime('%H', visit_time / 1000, 'unixepoch', 'localtime') AS hour, COUNT(*) AS visits
     FROM visits JOIN urls ON urls.id = visits.url_id GROUP BY hour`,
  ).all() as unknown as HourRow[]) {
    byHour[Number(bucket.hour)] = Number(bucket.visits)
  }

  const byDow = Array.from({ length: 7 }, () => 0)
  for (const bucket of db.prepare(
    `SELECT strftime('%w', visit_time / 1000, 'unixepoch', 'localtime') AS dow, COUNT(*) AS visits
     FROM visits JOIN urls ON urls.id = visits.url_id GROUP BY dow`,
  ).all() as unknown as DowRow[]) {
    byDow[Number(bucket.dow)] = Number(bucket.visits)
  }

  const busiestDays = (db.prepare(
    `SELECT DATE(visit_time / 1000, 'unixepoch', 'localtime') AS day, COUNT(*) AS visits
     FROM visits JOIN urls ON urls.id = visits.url_id GROUP BY day
     ORDER BY visits DESC, day LIMIT 5`,
  ).all() as unknown as DayRow[]).map((row) => ({ day: row.day, visits: Number(row.visits) }))

  return {
    totals,
    byHour: byHour.map((v, hour) => ({ hour, visits: v })),
    byDow: byDow.map((v, dow) => ({ dow, visits: v })),
    topDomains: topN(byDomain, 8),
    busiestDays,
  }
}

function monthStats(db: DatabaseSync, month: string): Stats {
  const [start, end] = monthRange(month)
  const urlGroups = db.prepare(
    `SELECT urls.url AS url, COUNT(*) AS visits,
            MIN(visits.visit_time) AS first_visit_time, MAX(visits.visit_time) AS last_visit_time
     FROM visits JOIN urls ON urls.id = visits.url_id
     WHERE ${MONTH_RANGE}
     GROUP BY urls.url`,
  ).all(start, end) as unknown as MonthUrlRow[]

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
  for (const bucket of db.prepare(
    `SELECT strftime('%H', visit_time / 1000, 'unixepoch', 'localtime') AS hour, COUNT(*) AS visits
     FROM visits JOIN urls ON urls.id = visits.url_id
     WHERE ${MONTH_RANGE}
     GROUP BY hour`,
  ).all(start, end) as unknown as HourRow[]) {
    byHour[Number(bucket.hour)] = Number(bucket.visits)
  }

  const byDow = Array.from({ length: 7 }, () => 0)
  for (const bucket of db.prepare(
    `SELECT strftime('%w', visit_time / 1000, 'unixepoch', 'localtime') AS dow, COUNT(*) AS visits
     FROM visits JOIN urls ON urls.id = visits.url_id
     WHERE ${MONTH_RANGE}
     GROUP BY dow`,
  ).all(start, end) as unknown as DowRow[]) {
    byDow[Number(bucket.dow)] = Number(bucket.visits)
  }

  const busiestDays = (db.prepare(
    `SELECT DATE(visit_time / 1000, 'unixepoch', 'localtime') AS day, COUNT(*) AS visits
     FROM visits JOIN urls ON urls.id = visits.url_id
     WHERE ${MONTH_RANGE}
     GROUP BY day
     ORDER BY visits DESC, day LIMIT 5`,
  ).all(start, end) as unknown as DayRow[]).map((row) => ({ day: row.day, visits: Number(row.visits) }))

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
