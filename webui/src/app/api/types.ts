import type { GithubKind, GithubVisitKind } from '@his/core'
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
  topDomains: { domain: string; visits: number }[]
  busiestDays: { day: string; visits: number }[]
}

// --- GitHub insights ---

export type { GithubKind, GithubVisitKind }

export interface GithubStats {
  totals: { visits: number; repos: number; owners: number; items: number; firstVisit: number; lastVisit: number }
  topRepos: { owner: string; repo: string; visits: number }[]
  topOwners: { owner: string; repos: number; visits: number }[]
  topItems: { owner: string; repo: string; kind: GithubKind; number: number; title: string; url: string; visits: number }[]
}

export interface GithubVisitsParams {
  month?: string
  owner?: string
  repo?: string
  kind?: GithubVisitKind
  cursor?: string
  limit?: number
}

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
  githubVisits(params: GithubVisitsParams): Promise<SearchPage>
  sourcesList(params?: SourcesListParams): Promise<SourceEntry[]>
  syncRun(params: SyncRunParams): Promise<SyncSummary>
  syncStatus(): Promise<SyncLastRun | null>
  settings: {
    get(): Promise<SettingsInfo>
    set(params: SettingsPatch): Promise<SettingsInfo>
  }
  on<K extends keyof HisEvents & string>(event: K, handler: HisEvents[K]): () => void
}
