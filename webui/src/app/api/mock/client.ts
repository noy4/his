import type { GithubStats, GithubVisitsParams, HisApi, HistoryItem, HistoryVisit, ItemDetail, SearchPage, SearchParams, SearchVisitsPage, SettingsInfo, SettingsPatch, SourceEntry, SourceProfile, SourcesListParams, Stats, SyncLastRun, SyncRunParams, SyncSummary, VisitItem } from '../types'
import { isoDay } from '@/lib/date'
import { hostWithoutWww, matchesHidden, matchesKind, mergeRepoRoots, parseGithubUrl, sourceKey, type GithubUrlInfo } from '@his/core'
import { MOCK_DISCOVERED, MOCK_ITEMS, MOCK_SOURCES, MOCK_VISITS } from './data'

const DEFAULT_LIMIT = 50
const SYNC_DELAY_MS = 600

function byLastVisitDesc(a: HistoryItem, b: HistoryItem): number {
  return b.lastVisit - a.lastVisit || b.id - a.id
}

function topN(map: Map<string, number>, n: number): { key: string; visits: number }[] {
  return [...map]
    .sort((a, b) => b[1] - a[1] || a[0].localeCompare(b[0]))
    .slice(0, n)
    .map(([key, visits]) => ({ key, visits }))
}

// --- hide patterns (settings) ---

let hiddenPatterns: string[] = []

function visibleItems(): HistoryItem[] {
  if (hiddenPatterns.length === 0) return [...MOCK_ITEMS]
  return MOCK_ITEMS.filter((item) => !matchesHidden(item.url, hiddenPatterns))
}

function hiddenUrlCount(patterns: string[]): number {
  if (patterns.length === 0) return 0
  return MOCK_ITEMS.filter((item) => matchesHidden(item.url, patterns)).length
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
    topDomains: topN(byDomain, 8).map(({ key, visits }) => ({ domain: key, visits })),
    busiestDays: topN(byDay, 5).map(({ key, visits }) => ({ day: key, visits })),
  }
}

// --- github ---

const GITHUB_TOP = 20

function githubItems(): { item: HistoryItem; urlInfo: GithubUrlInfo }[] {
  return visibleItems().flatMap((item) => {
    const urlInfo = parseGithubUrl(item.url)
    return urlInfo ? [{ item, urlInfo }] : []
  })
}

// month → item narrowed to that month's visits (counts / first / last), or null if unvisited
function inPeriod(item: HistoryItem, month?: string): HistoryItem | null {
  if (month === undefined) return item
  const visits = (MOCK_VISITS.get(item.id) ?? []).filter((visit) => isoDay(visit.visitTime).slice(0, 7) === month)
  if (visits.length === 0) return null
  const times = visits.map((visit) => visit.visitTime)
  return {
    ...item,
    visitCount: visits.length,
    typedCount: visits.filter((visit) => visit.transition === 'typed').length,
    firstVisit: Math.min(...times),
    lastVisit: Math.max(...times),
  }
}

function githubPeriod(month?: string): { item: HistoryItem; urlInfo: GithubUrlInfo }[] {
  return githubItems().flatMap(({ item, urlInfo }) => {
    const it = inPeriod(item, month)
    return it ? [{ item: it, urlInfo }] : []
  })
}

// 'Fix foo by bar · Pull Request #12 · o/r' → 'Fix foo by bar'
function cleanTitle(title: string): string {
  return title.split(' · ')[0]
}

function computeGithubStats(month?: string): GithubStats {
  const repos = new Map<string, { owner: string; repo: string; visits: number }>()
  const owners = new Map<string, { visits: number; repos: Set<string> }>()
  const items = new Map<string, GithubStats['topItems'][number] & { last: number }>()
  let visits = 0
  let firstVisit = Number.POSITIVE_INFINITY
  let lastVisit = 0

  for (const { item, urlInfo } of githubPeriod(month)) {
    const n = item.visitCount
    visits += n
    firstVisit = Math.min(firstVisit, item.firstVisit)
    lastVisit = Math.max(lastVisit, item.lastVisit)
    const o = owners.get(urlInfo.owner) ?? { visits: 0, repos: new Set<string>() }
    o.visits += n
    owners.set(urlInfo.owner, o)
    if (!urlInfo.repo) continue
    o.repos.add(urlInfo.repo)
    const rk = `${urlInfo.owner}/${urlInfo.repo}`
    const r = repos.get(rk) ?? { owner: urlInfo.owner, repo: urlInfo.repo, visits: 0 }
    r.visits += n
    repos.set(rk, r)
    if (!urlInfo.kind || urlInfo.number === undefined) continue
    const ik = `${rk}/${urlInfo.kind}/${urlInfo.number}`
    const cur = items.get(ik)
    if (cur) {
      cur.visits += n
      if (item.lastVisit > cur.last) Object.assign(cur, { title: cleanTitle(item.title), url: item.url, last: item.lastVisit })
    } else {
      items.set(ik, { owner: urlInfo.owner, repo: urlInfo.repo, kind: urlInfo.kind, number: urlInfo.number, title: cleanTitle(item.title), url: item.url, visits: n, last: item.lastVisit })
    }
  }

  const byVisits = <T extends { visits: number }>(a: T, b: T) => b.visits - a.visits
  return {
    totals: {
      visits,
      repos: repos.size,
      owners: owners.size,
      items: items.size,
      firstVisit: Number.isFinite(firstVisit) ? firstVisit : 0,
      lastVisit,
    },
    topRepos: [...repos.values()].sort(byVisits).slice(0, GITHUB_TOP),
    topOwners: [...owners]
      .map(([owner, o]) => ({ owner, repos: o.repos.size, visits: o.visits }))
      .sort(byVisits)
      .slice(0, GITHUB_TOP),
    topItems: [...items.values()]
      .sort(byVisits)
      .slice(0, GITHUB_TOP)
      .map(({ last: _, ...it }) => it),
  }
}

function githubVisits(params: GithubVisitsParams): SearchPage {
  const owner = params.owner?.toLowerCase()
  const repo = params.repo?.toLowerCase()
  const kind = params.kind ?? 'all'
  const rows = mergeRepoRoots(githubPeriod(params.month))
    .filter(({ urlInfo }) => (!owner || urlInfo.owner === owner) && (!repo || urlInfo.repo === repo) && matchesKind(urlInfo, kind))
    .map(({ item }) => item)
    .sort(byLastVisitDesc)
  return paginate(rows, params.cursor, params.limit)
}

// --- sources ---

// configured sync targets; empty means nothing syncs (explicit targets override)
let syncTargets: string[] = []
let sources: SourceProfile[] = MOCK_SOURCES.map((s) => ({ ...s }))
let inRun = false
let lastRunRecord: SyncLastRun | null = null

// explicit targets win, otherwise the configured targets
function wantedKeys(params: SyncRunParams): Set<string> {
  return new Set(params.targets ?? syncTargets)
}

// discovered ∪ registered
function sourceEntries(check: boolean): SourceEntry[] {
  const registeredByKey = new Map(sources.map((source) => [sourceKey(source), source]))
  const entries: SourceEntry[] = []
  const seen = new Set<string>()
  for (const target of MOCK_DISCOVERED) {
    const key = sourceKey(target)
    seen.add(key)
    const source = registeredByKey.get(key)
    entries.push(source
      ? { ...source, pending: check ? source.pending : null, registered: true }
      : { browser: target.browser, profile: target.profile, registered: false })
  }
  for (const source of sources) {
    const key = sourceKey(source)
    if (seen.has(key)) continue
    entries.push({ ...source, pending: check ? source.pending : null, registered: true })
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
      source.checkpoint.lastRunAt = runAt
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
    return { attempted: targets.length, failures: 0, skipped, insertedVisits: inserted, touchedUrls: synced, errors: [] }
  } finally {
    inRun = false
  }
}

function encodeCursor(time: number, id: number): string {
  return btoa(`v1.${time}.${id}`)
}

function decodeCursor(cursor: string): { time: number; id: number } | null {
  try {
    const m = /^v1\.(\d+)\.(\d+)$/.exec(atob(cursor))
    if (m === null) return null
    return { time: Number(m[1]), id: Number(m[2]) }
  } catch {
    return null
  }
}

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

// rows must be sorted by byLastVisitDesc; keyset on (lastVisit, id)
function paginate(rows: HistoryItem[], cursorText?: string, limit = DEFAULT_LIMIT): SearchPage {
  const cursor = cursorText ? decodeCursor(cursorText) : null
  const keyed = cursor
    ? rows.filter((it) => it.lastVisit < cursor.time || (it.lastVisit === cursor.time && it.id < cursor.id))
    : rows
  const page = keyed.slice(0, limit)
  const last = page.at(-1)
  const nextCursor = keyed.length > limit && last
    ? encodeCursor(last.lastVisit, last.id)
    : null
  return { items: page, nextCursor }
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

export const mockApi: HisApi = {
  async search(params: SearchParams): Promise<SearchPage> {
    return paginate(findVisible(params), params.cursor, params.limit)
  },

  async searchVisits(params: SearchParams): Promise<SearchVisitsPage> {
    return searchVisits(params)
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

  async stats(month?: string): Promise<Stats> {
    return month === undefined ? computeStats() : computeMonthlyStats(month)
  },

  async githubStats(month?: string): Promise<GithubStats> {
    return computeGithubStats(month)
  },

  async githubVisits(params: GithubVisitsParams): Promise<SearchPage> {
    return githubVisits(params)
  },

  async sourcesList(params?: SourcesListParams): Promise<SourceEntry[]> {
    return sourceEntries(params?.check === true)
  },

  syncRun: (params: SyncRunParams) => syncRun(params),

  async syncStatus(): Promise<SyncLastRun | null> {
    return lastRunRecord === null ? null : { ...lastRunRecord }
  },

  settings: {
    async get(): Promise<SettingsInfo> {
      return {
        hidden_patterns: [...hiddenPatterns],
        hidden_url_count: hiddenUrlCount(hiddenPatterns),
        sync_targets: [...syncTargets],
      }
    },
    async set(params: SettingsPatch): Promise<SettingsInfo> {
      if (params.hidden_patterns !== undefined) hiddenPatterns = params.hidden_patterns
      if (params.sync_targets !== undefined) syncTargets = params.sync_targets
      return {
        hidden_patterns: [...hiddenPatterns],
        hidden_url_count: hiddenUrlCount(hiddenPatterns),
        sync_targets: [...syncTargets],
      }
    },
  },

  on: () => () => { },
}
