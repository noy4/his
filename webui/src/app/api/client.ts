import type { GithubItemsFilter, GithubStats, HisApi, HisEvents, SearchPage, SearchFilter, SearchVisitsPage, SettingsInfo, SourceEntry, SourcesListParams, Stats, SyncLastRun, SyncRunParams, SyncSummary, YoutubeItemsFilter, YoutubeStats } from './types'
import { mockApi } from './mock/client'
import { RpcTransport } from '@/lib/rpc-transport'

export function createApi(): HisApi {
  if (import.meta.env.VITE_USE_MOCK_API === 'true') return mockApi
  const transport = new RpcTransport<HisEvents>(rpcUrl())
  return {
    history: {
      search: (params: SearchFilter) => transport.call<SearchPage>('history.search', params),
      searchVisits: (params: SearchFilter) => transport.call<SearchVisitsPage>('history.searchVisits', params),
      stats: (month?: string) => transport.call<Stats>('history.stats', { month }),
    },
    github: {
      stats: (month?: string) => transport.call<GithubStats>('history.githubStats', { month }),
      items: (params: GithubItemsFilter) => transport.call<SearchPage>('history.githubItems', params),
    },
    youtube: {
      stats: (month?: string) => transport.call<YoutubeStats>('history.youtubeStats', { month }),
      items: (params: YoutubeItemsFilter) => transport.call<SearchPage>('history.youtubeItems', params),
    },
    sources: {
      list: (params?: SourcesListParams) => transport.call<SourceEntry[]>('sources.list', params),
    },
    sync: {
      run: (params: SyncRunParams) => transport.call<SyncSummary>('sync.run', params),
      status: () => transport.call<SyncLastRun | null>('sync.status'),
    },
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
