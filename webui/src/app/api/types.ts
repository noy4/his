import type { GithubDayItem, GithubDayKind, GithubItemsFilter, GithubKind, GithubStats, GithubVisitKind, HistoryItem, HistoryVisit, ItemDetail, RegisteredSource, SearchFilter, SearchPage, SearchVisitsPage, SettingsInfo, SettingsPatch, SourceEntry, StatTotals, Stats, SyncLastRun, SyncOptions, SyncSummary, Transition, VisitItem, YoutubeItemsFilter, YoutubeStats, YoutubeVisitKind } from '@his/core'

// share types (incl. history stats/pages) — single source is @his/core
export type { HistoryItem, HistoryVisit, ItemDetail, SearchFilter, SearchPage, SearchVisitsPage }
export type { SettingsInfo, SettingsPatch, SourceEntry, StatTotals, Stats, Transition, VisitItem }
export type { SyncLastRun, SyncSummary }

// registered archive row — the stats half of a SourceEntry
export type SourceProfile = RegisteredSource

// sync.run RPC params — the same shape as the CLI --target flags
export type SyncRunParams = SyncOptions

// --- GitHub insights (types come from @his/core) ---

export type { GithubDayItem, GithubDayKind, GithubItemsFilter, GithubKind, GithubStats, GithubVisitKind }

// --- YouTube insights (types come from @his/core) ---

export type { YoutubeItemsFilter, YoutubeStats, YoutubeVisitKind }

export interface SourcesListParams {
  /** probe each source and report whether it changed since the last sync */
  check?: boolean
}

// notifications — not implemented (db.changed / sync.progress)
export interface HisEvents {
  [event: string]: (...args: any[]) => void
}

export interface HisApi {
  search(params: SearchFilter): Promise<SearchPage>
  searchVisits(params: SearchFilter): Promise<SearchVisitsPage>
  getVisits(urlId: number, limit?: number): Promise<VisitItem[]>
  getItem(id: number): Promise<ItemDetail | null>
  stats(month?: string): Promise<Stats>
  githubStats(month?: string): Promise<GithubStats>
  githubItems(params: GithubItemsFilter): Promise<SearchPage>
  youtubeItems(params: YoutubeItemsFilter): Promise<SearchPage>
  youtubeStats(month?: string): Promise<YoutubeStats>
  sourcesList(params?: SourcesListParams): Promise<SourceEntry[]>
  syncRun(params: SyncRunParams): Promise<SyncSummary>
  syncStatus(): Promise<SyncLastRun | null>
  settings: {
    get(): Promise<SettingsInfo>
    set(params: SettingsPatch): Promise<SettingsInfo>
  }
  on<K extends keyof HisEvents & string>(event: K, handler: HisEvents[K]): () => void
}
