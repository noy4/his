import type { GithubStats, GithubVisitsFilter, HisApi, HisEvents, ItemDetail, SearchPage, SearchFilter, SearchVisitsPage, SettingsInfo, SourceEntry, SourcesListParams, Stats, SyncLastRun, SyncRunParams, SyncSummary, VisitItem } from './types'
import { mockApi } from './mock/client'
import { RpcTransport } from '@/lib/rpc-transport'

export function createApi(): HisApi {
  if (import.meta.env.VITE_USE_MOCK_API === 'true') return mockApi
  const transport = new RpcTransport<HisEvents>(rpcUrl())
  return {
    search: (params: SearchFilter) => transport.call<SearchPage>('history.search', params),
    searchVisits: (params: SearchFilter) => transport.call<SearchVisitsPage>('history.searchVisits', params),
    getVisits: (urlId: number, limit?: number) => transport.call<VisitItem[]>('history.getVisits', { urlId, limit }),
    getItem: (id: number) => transport.call<ItemDetail | null>('history.getItem', { id }),
    stats: (month?: string) => transport.call<Stats>('history.stats', { month }),
    githubStats: (month?: string) => transport.call<GithubStats>('history.githubStats', { month }),
    githubVisits: (params: GithubVisitsFilter) => transport.call<SearchPage>('history.githubVisits', params),
    sourcesList: (params?: SourcesListParams) => transport.call<SourceEntry[]>('sources.list', params),
    syncRun: (params: SyncRunParams) => transport.call<SyncSummary>('sync.run', params),
    syncStatus: () => transport.call<SyncLastRun | null>('sync.status'),
    settings: {
      get: () => transport.call<SettingsInfo>('settings.get'),
      set: (params) => transport.call<SettingsInfo>('settings.set', params),
    },
    on: (event, handler) => transport.on(event, handler),
  }
}

declare global {
  interface Window {
    // Set by the server on the entry HTML (server/src/app.ts)
    __HIS__?: { token: string }
  }
}

// /rpc URL for this page, carrying the injected token when present
function rpcUrl(): string {
  const base = `${location.origin.replace(/^http/, 'ws')}/rpc`
  const token = window.__HIS__?.token
  return token === undefined
    ? base
    : `${base}?token=${encodeURIComponent(token)}`
}
