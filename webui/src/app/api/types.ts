import type { GithubDayItem, GithubDayKind, GithubKind, GithubStats, GithubVisitKind, GithubVisitsFilter } from '@his/core'
import type { HistoryItem, HistoryVisit, RegisteredSource, SettingsInfo, SettingsPatch, SourceEntry, SyncLastRun, SyncOptions, SyncSummary, Transition, VisitItem } from '@his/core'

export type { HistoryItem, HistoryVisit, SettingsInfo, SettingsPatch, SourceEntry, Transition, VisitItem }
export type { SyncLastRun, SyncSummary }

// registered archive row — the stats half of a SourceEntry
export type SourceProfile = RegisteredSource

// sync.run RPC params — the same shape as the CLI --target flags
export type SyncRunParams = SyncOptions

export interface ItemDetail {
  item: HistoryItem
  visits: VisitItem[]
}

export interface SearchParams {
  query?: string
  from?: number
  to?: number
  cursor?: string
  limit?: number
}

export interface SearchPage {
  items: HistoryItem[]
  nextCursor: string | null
}

export interface SearchVisitsPage {
  items: HistoryVisit[]
  nextCursor: string | null
}

export interface StatTotals {
  items: number
  visits: number
  domains: number
  firstVisit: number
  lastVisit: number
}

export interface Stats {
  totals: StatTotals
  byHour: { hour: number; visits: number }[]
  byDow: { dow: number; visits: number }[]
  byDay: { day: string; visits: number }[]
  topDomains: { domain: string; visits: number }[]
  busiestDays: { day: string; visits: number }[]
}

// --- GitHub insights (types come from @his/core) ---

export type { GithubDayItem, GithubDayKind, GithubKind, GithubStats, GithubVisitKind, GithubVisitsFilter }

export interface SourcesListParams {
  /** probe each source and report whether it changed since the last sync */
  check?: boolean
}

// notifications — not implemented (db.changed / sync.progress)
export interface HisEvents {
  [event: string]: (...args: any[]) => void
}

export interface HisApi {
  search(params: SearchParams): Promise<SearchPage>
  searchVisits(params: SearchParams): Promise<SearchVisitsPage>
  getVisits(urlId: number, limit?: number): Promise<VisitItem[]>
  getItem(id: number): Promise<ItemDetail | null>
  stats(month?: string): Promise<Stats>
  githubStats(month?: string): Promise<GithubStats>
  githubVisits(params: GithubVisitsFilter): Promise<SearchPage>
  sourcesList(params?: SourcesListParams): Promise<SourceEntry[]>
  syncRun(params: SyncRunParams): Promise<SyncSummary>
  syncStatus(): Promise<SyncLastRun | null>
  settings: {
    get(): Promise<SettingsInfo>
    set(params: SettingsPatch): Promise<SettingsInfo>
  }
  on<K extends keyof HisEvents & string>(event: K, handler: HisEvents[K]): () => void
}
