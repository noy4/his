import type { GithubSearchParams, GithubStats, SearchPage, SearchParams, SearchVisitsPage, SettingsInfo, SettingsPatch, SourceEntry, Stats, StatsParams, SyncOptions, SyncSummary, YoutubeSearchParams, YoutubeStats } from '@his/core'
import type { RpcCall } from '@/lib/rpc-transport'

export type {
  GithubDayItem, GithubDayKind, GithubKind, GithubSearchParams, GithubStats, GithubVisitKind, HistoryItem, HistoryVisit, SearchPage, SearchParams, SearchVisitsPage, SettingsInfo, SettingsPatch, SourceEntry, RegisteredSource, Stats, StatsParams, StatTotals, SyncSummary, Transition, VisitItem, YoutubeSearchParams, YoutubeStats, YoutubeVisitKind
} from '@his/core'

export type SyncRunParams = SyncOptions

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
    list(): Promise<SourceEntry[]>
  }
  sync: {
    run(params: SyncRunParams): Promise<SyncSummary>
    status(): Promise<SyncSummary | null>
  }
  settings: {
    get(): Promise<SettingsInfo>
    set(params: SettingsPatch): Promise<SettingsInfo>
  }
  rpc: RpcCall
  on<K extends keyof HisEvents & string>(event: K, handler: HisEvents[K]): () => void
}
