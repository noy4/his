import type { GithubKind, GithubVisitKind } from '@his/core'
import type { HistoryItem, HistoryVisit, RegisteredSource, SyncLastRun, SyncOptions, SyncSummary, Transition, VisitItem } from '@his/core'

export type { HistoryItem, HistoryVisit, Transition, VisitItem }
export type { SyncLastRun, SyncSummary }

// sources.list row — RegisteredSource (source_profiles + watermark) + listing aggregates
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

// --- settings ---

export interface SettingsInfo {
  /** user "hide" patterns — one per line in the UI */
  hiddenPatterns: string[]
}

// notifications — sync.progress is on hold (see SPEC); db.changed pending
// open-ended so new server events can arrive before the map lists them
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
  sourcesList(params?: SourcesListParams): Promise<SourceProfile[]>
  syncRun(params: SyncRunParams): Promise<SyncSummary>
  syncStatus(): Promise<SyncLastRun | null>
  settings: {
    get(): Promise<SettingsInfo>
    set(params: { hiddenPatterns: string[] }): Promise<SettingsInfo>
  }
  on<K extends keyof HisEvents & string>(event: K, handler: HisEvents[K]): () => void
}
