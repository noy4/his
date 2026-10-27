import type { GithubItemsFilter, GithubStats, HisApi, HisEvents, SearchPage, SearchFilter, SearchVisitsPage, SettingsInfo, SourceEntry, SourcesListParams, Stats, SyncLastRun, SyncRunParams, SyncSummary, YoutubeItemsFilter, YoutubeStats } from './types'
import { mockApi } from './mock/client'
import { RpcTransport } from '@/lib/rpc-transport'

export function createApi(): HisApi {
  if (import.meta.env.VITE_USE_MOCK_API === 'true') return mockApi

  const transport = new RpcTransport<HisEvents>(rpcUrl())
  function call<T>(method: string, params?: unknown): Promise<T> {
    return transport.call<T>(method, params)
  }

  return {
    history: {
      search: (params: SearchFilter) => call<SearchPage>('history.search', params),
      searchVisits: (params: SearchFilter) => call<SearchVisitsPage>('history.searchVisits', params),
      stats: (month?: string) => call<Stats>('history.stats', { month }),
    },
    github: {
      stats: (month?: string) => call<GithubStats>('history.githubStats', { month }),
      items: (params: GithubItemsFilter) => call<SearchPage>('history.githubItems', params),
    },
    youtube: {
      stats: (month?: string) => call<YoutubeStats>('history.youtubeStats', { month }),
      items: (params: YoutubeItemsFilter) => call<SearchPage>('history.youtubeItems', params),
    },
    sources: {
      list: (params?: SourcesListParams) => call<SourceEntry[]>('sources.list', params),
    },
    sync: {
      run: (params: SyncRunParams) => call<SyncSummary>('sync.run', params),
      status: () => call<SyncLastRun | null>('sync.status'),
    },
    settings: {
      get: () => call<SettingsInfo>('settings.get'),
      set: (params) => call<SettingsInfo>('settings.set', params),
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
