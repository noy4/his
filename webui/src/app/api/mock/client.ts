import type { HisApi, HistoryItem, HistoryVisit, RegisteredSource, SearchPage, SearchParams, SearchVisitsPage, SettingsInfo, SettingsPatch, SourceEntry, Stats, SyncRunParams, SyncSummary } from '../types'
import type { RpcCall } from '@/lib/rpc-transport'
import { hostWithoutWww, sourceKey } from '@his/core'
import { isoDay } from '@/lib/date'
import { VIEW_PLUGINS } from '@/plugins/registry'
import {
  DEFAULT_LIMIT, MOCK_DISCOVERED, MOCK_SOURCES, MOCK_VISITS,
  byLastVisitDesc, decodeCursor, encodeCursor, getHiddenPatterns, hiddenUrlCount,
  paginate, setHiddenPatterns, sortByDay, visibleItems,
} from './kit'

const SYNC_DELAY_MS = 600

function topN(map: Map<string, number>, n: number): { key: string; visits: number }[] {
  return [...map]
    .sort((a, b) => b[1] - a[1] || a[0].localeCompare(b[0]))
    .slice(0, n)
    .map(([key, visits]) => ({ key, visits }))
}

function computeStats(): Stats {
  const visible = visibleItems()
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
    const host = hostWithoutWww(it.url)
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
    byDay: sortByDay(byDay),
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

  for (const it of visibleItems()) {
    const host = hostWithoutWww(it.url)
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
    byDay: sortByDay(byDay),
    topDomains: topN(byDomain, 8).map(({ key, visits }) => ({ domain: key, visits })),
    busiestDays: topN(byDay, 5).map(({ key, visits }) => ({ day: key, visits })),
  }
}

// --- sources / sync ---

// configured sync targets; empty means nothing syncs (explicit targets override)
// demo preselects one source so the sources view never renders empty
let syncTargets: string[] = [sourceKey(MOCK_SOURCES[0])]
const sources: RegisteredSource[] = MOCK_SOURCES.map((s) => ({ ...s }))
let inRun = false
let lastRunRecord: SyncSummary | null = null

// explicit targets win, otherwise the configured targets
function wantedKeys(params: SyncRunParams): Set<string> {
  return new Set(params.targets ?? syncTargets)
}

// discovered ∪ registered
function sourceEntries(): SourceEntry[] {
  const registeredByKey = new Map(sources.map((source) => [sourceKey(source), source]))
  const entries: SourceEntry[] = []
  const seen = new Set<string>()
  for (const target of MOCK_DISCOVERED) {
    const key = sourceKey(target)
    seen.add(key)
    const source = registeredByKey.get(key)
    entries.push(source
      ? { ...source, registered: true }
      : { ...target, registered: false })
  }
  for (const source of sources) {
    const key = sourceKey(source)
    if (seen.has(key)) continue
    entries.push({ ...source, registered: true })
  }
  return entries
}

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
    const wanted = wantedKeys(params)
    const targets = sources.filter((s) => wanted.has(sourceKey(s)))
    let skipped = 0
    let inserted = 0
    const runAt = Date.now()
    for (const source of targets) {
      if (source.browser === 'firefox') {
        skipped += 1
        continue
      }
      const bump = 1 + (hashKey(sourceKey(source)) % 800)
      source.visits += bump
      source.lastVisit = runAt - (hashKey(source.profile) % 3_600_000)
      source.lastRunAt = runAt
      inserted += bump
    }
    const synced = targets.length - skipped
    const summary: SyncSummary = { startedAt, finishedAt: Date.now(), attempted: targets.length, failures: 0, skipped, insertedVisits: inserted, touchedUrls: synced, errors: [] }
    lastRunRecord = summary
    return summary
  } finally {
    inRun = false
  }
}

// --- history ---

function findVisible(params: SearchParams): HistoryItem[] {
  const q = params.query?.trim().toLowerCase() ?? ''
  const from = params.from ?? -Infinity
  const to = params.to ?? Infinity
  const rows = visibleItems().filter(
    (it) =>
      it.lastVisit >= from &&
      it.lastVisit <= to &&
      (q === '' || it.title.toLowerCase().includes(q) || it.url.toLowerCase().includes(q)),
  )
  rows.sort(byLastVisitDesc)
  return rows
}

function searchVisits(params: SearchParams): SearchVisitsPage {
  const query = params.query?.trim().toLowerCase() ?? ''
  const from = params.from ?? -Infinity
  const to = params.to ?? Infinity
  const cursor = params.cursor ? decodeCursor(params.cursor) : null
  const limit = Number.isFinite(params.limit)
    ? Math.min(200, Math.max(1, Math.trunc(params.limit!)))
    : DEFAULT_LIMIT
  const rows: HistoryVisit[] = visibleItems().flatMap((item) => {
    if (query && !item.title.toLowerCase().includes(query) && !item.url.toLowerCase().includes(query)) return []
    return (MOCK_VISITS.get(item.id) ?? []).map((visit) => ({
      ...visit,
      url: item.url,
      title: item.title,
      visitCount: item.visitCount,
    }))
  }).filter((visit) =>
    visit.visitTime >= from && visit.visitTime <= to &&
    (!cursor || visit.visitTime < cursor.time || (visit.visitTime === cursor.time && visit.id < cursor.id)),
  ).sort((a, b) => b.visitTime - a.visitTime || b.id - a.id)
  const items = rows.slice(0, limit)
  const last = items.at(-1)
  return {
    items,
    nextCursor: rows.length > limit && last
      ? encodeCursor(last.visitTime, last.id)
      : null,
  }
}

// --- api ---

const coreApi: Omit<HisApi, 'rpc' | 'on'> = {
  history: {
    async stats({ month } = {}): Promise<Stats> {
      return month === undefined ? computeStats() : computeMonthlyStats(month)
    },
    async search(params: SearchParams): Promise<SearchPage> {
      return paginate(findVisible(params), params.cursor, params.limit)
    },
    async searchVisits(params: SearchParams): Promise<SearchVisitsPage> {
      return searchVisits(params)
    },
  },
  sources: {
    async list(): Promise<SourceEntry[]> {
      return sourceEntries()
    },
  },
  sync: {
    run: (params: SyncRunParams) => syncRun(params),
    async status(): Promise<SyncSummary | null> {
      return lastRunRecord === null ? null : { ...lastRunRecord }
    },
  },
  settings: {
    async get(): Promise<SettingsInfo> {
      const hidden = getHiddenPatterns()
      return {
        hidden_patterns: [...hidden],
        hidden_url_count: hiddenUrlCount(hidden),
        sync_targets: [...syncTargets],
      }
    },
    async set(params: SettingsPatch): Promise<SettingsInfo> {
      if (params.hidden_patterns !== undefined) setHiddenPatterns(params.hidden_patterns)
      if (params.sync_targets !== undefined) syncTargets = params.sync_targets
      const hidden = getHiddenPatterns()
      return {
        hidden_patterns: [...hidden],
        hidden_url_count: hiddenUrlCount(hidden),
        sync_targets: [...syncTargets],
      }
    },
  },
}

// plugin RPC namespaces, contributed by each ViewPlugin
const pluginApi = Object.assign({}, ...VIEW_PLUGINS.map((plugin) => plugin.mock ?? {}))
const impl = { ...coreApi, ...pluginApi }

export const mockApi: HisApi = {
  ...coreApi,
  rpc: rpcFrom(impl),
  on: () => () => { },
}

function rpcFrom(api: object): RpcCall {
  return <R>(method: string, params?: unknown): Promise<R> => {
    const [namespace, fn] = method.split('.')
    const group = (api as Record<string, Record<string, (p?: unknown) => Promise<unknown>> | undefined>)[namespace]
    const call = group?.[fn]
    if (call === undefined) return Promise.reject(new Error(`unknown rpc method: ${method}`))
    return call(params) as Promise<R>
  }
}
