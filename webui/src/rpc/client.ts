import type { GithubStats, GithubVisitsParams, HisApi, HisEvents, ItemDetail, SearchPage, SearchParams, SearchVisitsPage, SourceProfile, Stats, SyncLastRun, SyncRunParams, SyncSummary, VisitItem } from '@/api'
import { mockApi } from '@/mock/mock-api'
import { RpcTransport } from '@/rpc/transport'

export function createApi(): HisApi {
  if (import.meta.env.VITE_USE_MOCK_API === 'true') return mockApi
  const transport = new RpcTransport<HisEvents>()
  return {
    search: (params: SearchParams) => transport.call<SearchPage>('history.search', params),
    searchVisits: (params: SearchParams) => transport.call<SearchVisitsPage>('history.searchVisits', params),
    getVisits: (urlId: number, limit?: number) => transport.call<VisitItem[]>('history.getVisits', { urlId, limit }),
    getItem: (id: number) => transport.call<ItemDetail | null>('history.getItem', { id }),
    stats: (month?: string) => transport.call<Stats>('history.stats', { month }),
    githubStats: (month?: string) => transport.call<GithubStats>('history.githubStats', { month }),
    githubVisits: (params: GithubVisitsParams) => transport.call<SearchPage>('history.githubVisits', params),
    sourcesList: () => transport.call<SourceProfile[]>('sources.list'),
    syncRun: (params: SyncRunParams) => transport.call<SyncSummary>('sync.run', params),
    syncStatus: () => transport.call<SyncLastRun | null>('sync.status'),
    on: (event, handler) => transport.on(event, handler),
  }
}
