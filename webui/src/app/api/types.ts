import type { GithubDayItem, GithubDayKind, GithubItemsFilter, GithubKind, GithubStats, GithubVisitKind, HistoryItem, HistoryVisit, RegisteredSource, SearchFilter, SearchPage, SearchVisitsPage, SettingsInfo, SettingsPatch, SourceEntry, StatTotals, Stats, SyncLastRun, SyncOptions, SyncSummary, Transition, VisitItem, YoutubeItemsFilter, YoutubeStats, YoutubeVisitKind } from '@his/core'

// share types (incl. history stats/pages) — single source is @his/core
export type { HistoryItem, HistoryVisit, SearchFilter, SearchPage, SearchVisitsPage }
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
  history: {
    search(params: SearchFilter): Promise<SearchPage>
    searchVisits(params: SearchFilter): Promise<SearchVisitsPage>
    stats(month?: string): Promise<Stats>
  }
  github: {
    stats(month?: string): Promise<GithubStats>
    items(params: GithubItemsFilter): Promise<SearchPage>
  }
  youtube: {
    stats(month?: string): Promise<YoutubeStats>
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
