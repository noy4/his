import type { GithubDayItem, GithubDayKind, GithubSearchParams, GithubKind, GithubStats, GithubVisitKind, HistoryItem, HistoryVisit, RegisteredSource, SearchParams, SearchPage, SearchVisitsPage, SettingsInfo, SettingsPatch, SourceEntry, StatTotals, Stats, StatsParams, SyncLastRun, SyncOptions, SyncSummary, Transition, VisitItem, YoutubeSearchParams, YoutubeStats, YoutubeVisitKind } from '@his/core'

export type { HistoryItem, HistoryVisit, SearchParams, SearchPage, SearchVisitsPage }
export type { SettingsInfo, SettingsPatch, SourceEntry, StatTotals, Stats, StatsParams, Transition, VisitItem }
export type { SyncLastRun, SyncSummary }

export type SourceProfile = RegisteredSource
export type SyncRunParams = SyncOptions

export type { GithubDayItem, GithubDayKind, GithubSearchParams, GithubKind, GithubStats, GithubVisitKind }
export type { YoutubeSearchParams, YoutubeStats, YoutubeVisitKind }

export interface SourcesListParams {
  /** probe each source and report whether it changed since the last sync */
  check?: boolean
}

// notifications — not implemented (db.changed / sync.progress)
export interface HisEvents {
  [event: string]: (...args: any[]) => void
}

export interface HisApi {
  history: {
    stats(params?: StatsParams): Promise<Stats>
    search(params: SearchParams): Promise<SearchPage>
    searchVisits(params: SearchParams): Promise<SearchVisitsPage>
  }
  github: {
    stats(params?: StatsParams): Promise<GithubStats>
    search(params: GithubSearchParams): Promise<SearchPage>
  }
  youtube: {
    stats(params?: StatsParams): Promise<YoutubeStats>
    search(params: YoutubeSearchParams): Promise<SearchPage>
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
