import { RpcTransport } from '@/lib/rpc-transport'
import { mockApi } from './mock/client'
import type { GithubStats, HisApi, HisEvents, SearchPage, SearchVisitsPage, SettingsInfo, SourceEntry, Stats, SyncLastRun, SyncSummary, YoutubeStats } from './types'

export function createApi(): HisApi {
  if (import.meta.env.VITE_USE_MOCK_API === 'true') return mockApi

  const transport = new RpcTransport<HisEvents>(rpcUrl())
  function call<T>(method: string, params?: unknown): Promise<T> {
    return transport.call<T>(method, params)
  }

  return {
    history: {
      search: (params) => call<SearchPage>('history.search', params),
      searchVisits: (params) => call<SearchVisitsPage>('history.searchVisits', params),
      stats: (params) => call<Stats>('history.stats', params),
    },
    github: {
      stats: (params) => call<GithubStats>('history.githubStats', params),
      items: (params) => call<SearchPage>('history.githubItems', params),
    },
    youtube: {
      stats: (params) => call<YoutubeStats>('history.youtubeStats', params),
      items: (params) => call<SearchPage>('history.youtubeItems', params),
    },
    sources: {
      list: (params) => call<SourceEntry[]>('sources.list', params),
    },
    sync: {
      run: (params) => call<SyncSummary>('sync.run', params),
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
