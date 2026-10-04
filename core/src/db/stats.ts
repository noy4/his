import type { DatabaseSync } from 'node:sqlite'
import type { EpochMs } from '../model.ts'

// --- contract ---

// Dashboard aggregates — visible rows only (hidden_at IS NULL), matching the
// WebUI Stats shape 1:1 so the RPC result needs no reshaping. Day / hour /
// weekday buckets use the server's local timezone; days are 'YYYY-MM-DD'.
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

export function stats(db: DatabaseSync): Stats {
  const rows = db
    .prepare('SELECT url, visit_count, first_visit_time, last_visit_time FROM urls WHERE hidden_at IS NULL')
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
     FROM visits JOIN urls ON urls.id = visits.url_id WHERE urls.hidden_at IS NULL GROUP BY hour`,
  ).all() as unknown as HourRow[]) {
    byHour[Number(bucket.hour)] = Number(bucket.visits)
  }

  const byDow = Array.from({ length: 7 }, () => 0)
  for (const bucket of db.prepare(
    `SELECT strftime('%w', visit_time / 1000, 'unixepoch', 'localtime') AS dow, COUNT(*) AS visits
     FROM visits JOIN urls ON urls.id = visits.url_id WHERE urls.hidden_at IS NULL GROUP BY dow`,
  ).all() as unknown as DowRow[]) {
    byDow[Number(bucket.dow)] = Number(bucket.visits)
  }

  const busiestDays = (db.prepare(
    `SELECT DATE(visit_time / 1000, 'unixepoch', 'localtime') AS day, COUNT(*) AS visits
     FROM visits JOIN urls ON urls.id = visits.url_id WHERE urls.hidden_at IS NULL GROUP BY day
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

// --- helpers ---

interface UrlRow {
  url: string
  visit_count: number
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
