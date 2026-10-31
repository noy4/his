import type { SearchPage, SearchParams, SearchVisitsPage, SettingsInfo, SettingsPatch, SourceEntry, Stats, StatsParams, SyncOptions, SyncSummary } from '@his/core'
import type { RpcCall } from '@/lib/rpc-transport'

export type {
  HistoryItem, HistoryVisit, RegisteredSource, SearchPage, SearchParams, SearchVisitsPage, SettingsInfo, SettingsPatch, SourceEntry, Stats, SyncSummary, Transition, VisitItem
} from '@his/core'

export type SyncRunParams = SyncOptions

// notifications — not implemented
export interface HisEvents {
  [event: string]: (...args: any[]) => void
}

export interface HisApi {
  history: {
    stats(params?: StatsParams): Promise<Stats>
    search(params: SearchParams): Promise<SearchPage>
    searchVisits(params: SearchParams): Promise<SearchVisitsPage>
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
