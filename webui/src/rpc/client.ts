import type { HisApi, HisEvents, ItemDetail, SearchPage, SearchParams, SourceProfile, Stats, SyncLastRun, SyncRunParams, SyncSummary, VisitItem } from '@/api'
import { mockApi } from '@/mock/api'
import { RpcTransport } from '@/rpc/transport'

export function createApi(): HisApi {
  if (import.meta.env.VITE_USE_MOCK_API === 'true') return mockApi
  const transport = new RpcTransport<HisEvents>()
  return {
    search: (params: SearchParams) => transport.call<SearchPage>('history.search', params),
    getVisits: (urlId: number, limit?: number) => transport.call<VisitItem[]>('history.getVisits', { urlId, limit }),
    getItem: (id: number) => transport.call<ItemDetail | null>('history.getItem', { id }),
    deleteUrl: (url: string) => transport.call('history.deleteUrl', { url }).then(() => undefined),
    restoreUrl: (url: string) => transport.call('history.restoreUrl', { url }).then(() => undefined),
    stats: (month?: string) => transport.call<Stats>('history.stats', { month }),
    sourcesList: () => transport.call<SourceProfile[]>('sources.list'),
    syncRun: (params: SyncRunParams) => transport.call<SyncSummary>('sync.run', params),
    syncStatus: () => transport.call<SyncLastRun | null>('sync.status'),
    on: (event, handler) => transport.on(event, handler),
  }
}
