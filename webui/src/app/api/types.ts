import type { GithubDayItem, GithubDayKind, GithubItemsFilter, GithubKind, GithubStats, GithubVisitKind, HistoryItem, HistoryVisit, RegisteredSource, SearchFilter, SearchPage, SearchVisitsPage, SettingsInfo, SettingsPatch, SourceEntry, StatTotals, Stats, SyncLastRun, SyncOptions, SyncSummary, Transition, VisitItem, YoutubeItemsFilter, YoutubeStats, YoutubeVisitKind } from '@his/core'

export type { HistoryItem, HistoryVisit, SearchFilter, SearchPage, SearchVisitsPage }
export type { SettingsInfo, SettingsPatch, SourceEntry, StatTotals, Stats, Transition, VisitItem }
export type { SyncLastRun, SyncSummary }

export type SourceProfile = RegisteredSource
export type SyncRunParams = SyncOptions

export type { GithubDayItem, GithubDayKind, GithubItemsFilter, GithubKind, GithubStats, GithubVisitKind }
export type { YoutubeItemsFilter, YoutubeStats, YoutubeVisitKind }

export interface SourcesListParams {
  /** probe each source and report whether it changed since the last sync */
  check?: boolean
}

export interface StatsParams {
  month?: string
}

// notifications — not implemented (db.changed / sync.progress)
export interface HisEvents {
  [event: string]: (...args: any[]) => void
}

export interface HisApi {
  history: {
    search(params: SearchFilter): Promise<SearchPage>
    searchVisits(params: SearchFilter): Promise<SearchVisitsPage>
    stats(params?: StatsParams): Promise<Stats>
  }
  github: {
    stats(params?: StatsParams): Promise<GithubStats>
    items(params: GithubItemsFilter): Promise<SearchPage>
  }
  youtube: {
    stats(params?: StatsParams): Promise<YoutubeStats>
    items(params: YoutubeItemsFilter): Promise<SearchPage>
  }
  sources: {
    list(params?: SourcesListParams): Promise<SourceEntry[]>
  }
  sync: {
    run(params: SyncRunParams): Promise<SyncSummary>
    status(): Promise<SyncLastRun | null>
  }
  settings: {
    get(): Promise<SettingsInfo>
    set(params: SettingsPatch): Promise<SettingsInfo>
  }
  on<K extends keyof HisEvents & string>(event: K, handler: HisEvents[K]): () => void
}
