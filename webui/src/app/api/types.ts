import type { GithubDayItem, GithubDayKind, GithubSearchFilter, GithubKind, GithubStats, GithubVisitKind, HistoryItem, HistoryVisit, RegisteredSource, SearchFilter, SearchPage, SearchVisitsPage, SettingsInfo, SettingsPatch, SourceEntry, StatTotals, Stats, StatsParams, SyncLastRun, SyncOptions, SyncSummary, Transition, VisitItem, YoutubeSearchFilter, YoutubeStats, YoutubeVisitKind } from '@his/core'

export type { HistoryItem, HistoryVisit, SearchFilter, SearchPage, SearchVisitsPage }
export type { SettingsInfo, SettingsPatch, SourceEntry, StatTotals, Stats, StatsParams, Transition, VisitItem }
export type { SyncLastRun, SyncSummary }

export type SourceProfile = RegisteredSource
export type SyncRunParams = SyncOptions

export type { GithubDayItem, GithubDayKind, GithubSearchFilter, GithubKind, GithubStats, GithubVisitKind }
export type { YoutubeSearchFilter, YoutubeStats, YoutubeVisitKind }

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
    search(params: SearchFilter): Promise<SearchPage>
    searchVisits(params: SearchFilter): Promise<SearchVisitsPage>
  }
  github: {
    stats(params?: StatsParams): Promise<GithubStats>
    search(params: GithubSearchFilter): Promise<SearchPage>
  }
  youtube: {
    stats(params?: StatsParams): Promise<YoutubeStats>
    search(params: YoutubeSearchFilter): Promise<SearchPage>
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
