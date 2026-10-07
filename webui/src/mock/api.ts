import type { HisApi, HistoryItem, ItemDetail, SearchPage, SearchParams, SourceProfile, Stats, SyncLastRun, SyncRunParams, SyncSummary, VisitItem } from '@/api'
import { isoDay } from '@/lib/date'
import { MOCK_ITEMS, MOCK_SOURCES, MOCK_VISITS } from './data'

const DEFAULT_LIMIT = 50
const SYNC_DELAY_MS = 600

function byLastVisitDesc(a: HistoryItem, b: HistoryItem): number {
  return b.lastVisit - a.lastVisit || b.id - a.id
}

function hostOf(url: string): string {
  try {
    return new URL(url).hostname.replace(/^www\./, '')
  } catch {
    return url
  }
}

function topN(map: Map<string, number>, n: number): { key: string; visits: number }[] {
  return [...map]
    .sort((a, b) => b[1] - a[1] || a[0].localeCompare(b[0]))
    .slice(0, n)
    .map(([key, visits]) => ({ key, visits }))
}

function computeStats(): Stats {
  const visible = MOCK_ITEMS.filter((it) => it.hiddenAt === null)
  const byHour = new Array<number>(24).fill(0)
  const byDow = new Array<number>(7).fill(0)
  const byDay = new Map<string, number>()
  const byDomain = new Map<string, number>()
  let visits = 0
  let firstVisit = Number.POSITIVE_INFINITY
  let lastVisit = 0

  for (const it of visible) {
    visits += it.visitCount
    firstVisit = Math.min(firstVisit, it.firstVisit)
    lastVisit = Math.max(lastVisit, it.lastVisit)
    const host = hostOf(it.url)
    byDomain.set(host, (byDomain.get(host) ?? 0) + it.visitCount)
    for (const v of MOCK_VISITS.get(it.id) ?? []) {
      const d = new Date(v.visitTime)
      byHour[d.getHours()] += 1
      byDow[d.getDay()] += 1
      const day = isoDay(v.visitTime)
      byDay.set(day, (byDay.get(day) ?? 0) + 1)
    }
  }

  return {
    totals: { items: visible.length, visits, domains: byDomain.size, firstVisit, lastVisit },
    byHour: byHour.map((v, hour) => ({ hour, visits: v })),
    byDow: byDow.map((v, dow) => ({ dow, visits: v })),
    topDomains: topN(byDomain, 8).map(({ key, visits }) => ({ domain: key, visits })),
    busiestDays: topN(byDay, 5).map(({ key, visits }) => ({ day: key, visits })),
  }
}

function computeMonthlyStats(month: string): Stats {
  const byHour = new Array<number>(24).fill(0)
  const byDow = new Array<number>(7).fill(0)
  const byDay = new Map<string, number>()
  const byDomain = new Map<string, number>()
  const visitedUrls = new Set<number>()
  let visits = 0
  let firstVisit = Number.POSITIVE_INFINITY
  let lastVisit = 0

  for (const it of MOCK_ITEMS) {
    if (it.hiddenAt !== null) continue
    const host = hostOf(it.url)
    for (const v of MOCK_VISITS.get(it.id) ?? []) {
      const day = isoDay(v.visitTime)
      if (day.slice(0, 7) !== month) continue
      visits += 1
      visitedUrls.add(it.id)
      firstVisit = Math.min(firstVisit, v.visitTime)
      lastVisit = Math.max(lastVisit, v.visitTime)
      byDomain.set(host, (byDomain.get(host) ?? 0) + 1)
      byHour[new Date(v.visitTime).getHours()] += 1
      byDow[new Date(v.visitTime).getDay()] += 1
      byDay.set(day, (byDay.get(day) ?? 0) + 1)
    }
  }

  return {
    totals: {
      items: visitedUrls.size,
      visits,
      domains: byDomain.size,
      firstVisit: Number.isFinite(firstVisit) ? firstVisit : 0,
      lastVisit,
    },
    byHour: byHour.map((v, hour) => ({ hour, visits: v })),
    byDow: byDow.map((v, dow) => ({ dow, visits: v })),
    topDomains: topN(byDomain, 8).map(({ key, visits }) => ({ domain: key, visits })),
    busiestDays: topN(byDay, 5).map(({ key, visits }) => ({ day: key, visits })),
  }
}

const stats = computeStats()

// --- sources ---

const keyOf = (s: SourceProfile): string => `${s.browser}:${s.profile}`

let sources: SourceProfile[] = MOCK_SOURCES.map((s) => ({ ...s }))
let inRun = false
let lastRunRecord: SyncLastRun | null = null

function hashKey(text: string): number {
  let h = 0
  for (let i = 0; i < text.length; i++) h = (h * 31 + text.charCodeAt(i)) | 0
  return Math.abs(h)
}

function delay(ms: number): Promise<void> {
  return new Promise((resolve) => setTimeout(resolve, ms))
}

async function syncRun(params: SyncRunParams): Promise<SyncSummary> {
  if (inRun) throw new Error('sync already running')
  inRun = true
  const startedAt = Date.now()
  try {
    await delay(SYNC_DELAY_MS)
    const wanted = params.targets === undefined ? null : new Set(params.targets)
    const targets = sources.filter((s) => wanted === null || wanted.has(keyOf(s)))
    let skipped = 0
    let inserted = 0
    const runAt = Date.now()
    for (const source of targets) {
      if (source.browser === 'firefox') {
        skipped += 1
        continue
      }
      const bump = 1 + (hashKey(keyOf(source)) % 800)
      source.visits += bump
      source.lastVisit = runAt - (hashKey(source.profile) % 3_600_000)
      source.watermark.lastRunAt = runAt
      inserted += bump
    }
    const synced = targets.length - skipped
    lastRunRecord = {
      startedAt,
      finishedAt: Date.now(),
      ok: true,
      error: null,
      attempted: targets.length,
      failures: 0,
      insertedVisits: inserted,
      touchedUrls: synced,
    }
    return { attempted: targets.length, failures: 0, skipped, insertedVisits: inserted, touchedUrls: synced }
  } finally {
    inRun = false
  }
}

function encodeCursor(item: HistoryItem): string {
  return btoa(`v1.${item.lastVisit}.${item.id}`)
}

function decodeCursor(cursor: string): { lastVisit: number; id: number } | null {
  try {
    const m = /^v1\.(\d+)\.(\d+)$/.exec(atob(cursor))
    if (m === null) return null
    return { lastVisit: Number(m[1]), id: Number(m[2]) }
  } catch {
    return null
  }
}

function findVisible(params: SearchParams): HistoryItem[] {
  const q = params.query?.trim().toLowerCase() ?? ''
  const from = params.from ?? -Infinity
  const to = params.to ?? Infinity
  const rows = MOCK_ITEMS.filter(
    (it) =>
      it.hiddenAt === null &&
      it.lastVisit >= from &&
      it.lastVisit <= to &&
      (q === '' || it.title.toLowerCase().includes(q) || it.url.toLowerCase().includes(q)),
  )
  rows.sort(byLastVisitDesc)
  return rows
}

export const mockApi: HisApi = {
  async search(params: SearchParams): Promise<SearchPage> {
    const rows = findVisible(params)
    const cursor = params.cursor ? decodeCursor(params.cursor) : null
    const keyed = cursor
      ? rows.filter((it) => it.lastVisit < cursor.lastVisit || (it.lastVisit === cursor.lastVisit && it.id < cursor.id))
      : rows
    const limit = params.limit ?? DEFAULT_LIMIT
    const page = keyed.slice(0, limit)
    const nextCursor = keyed.length > limit && page.length > 0 ? encodeCursor(page[page.length - 1]) : null
    return { items: page, nextCursor }
  },

  async getVisits(urlId: number, limit?: number): Promise<VisitItem[]> {
    const visits = MOCK_VISITS.get(urlId) ?? []
    return limit === undefined ? visits : visits.slice(0, limit)
  },

  async getItem(id: number): Promise<ItemDetail | null> {
    const item = MOCK_ITEMS.find((it) => it.id === id)
    if (item === undefined) return null
    return { item, visits: MOCK_VISITS.get(id) ?? [] }
  },

  async deleteUrl(url: string): Promise<void> {
    const item = MOCK_ITEMS.find((it) => it.url === url)
    if (item !== undefined) item.hiddenAt = Date.now()
  },

  async restoreUrl(url: string): Promise<void> {
    const item = MOCK_ITEMS.find((it) => it.url === url)
    if (item !== undefined) item.hiddenAt = null
  },

  async stats(month?: string): Promise<Stats> {
    return month === undefined ? stats : computeMonthlyStats(month)
  },

  async sourcesList(): Promise<SourceProfile[]> {
    return sources.map((s) => ({ ...s }))
  },

  syncRun: (params: SyncRunParams) => syncRun(params),

  async syncStatus(): Promise<SyncLastRun | null> {
    return lastRunRecord === null ? null : { ...lastRunRecord }
  },

  on: () => () => {},
}
