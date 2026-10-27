import { RpcTransport } from '@/lib/rpc-transport'
import { mockApi } from './mock/client'
import type { GithubStats, HisApi, HisEvents, SearchPage, SearchVisitsPage, SettingsInfo, SourceEntry, Stats, SyncLastRun, SyncSummary, YoutubeStats } from './types'

export function createApi(): HisApi {
  if (import.meta.env.VITE_USE_MOCK_API === 'true') return mockApi

  const transport = new RpcTransport<HisEvents>(rpcUrl())
  function handler<T>(method: string) {
    return (params?: unknown) => transport.call<T>(method, params)
  }

  return {
    history: {
      search: handler<SearchPage>('history.search'),
      searchVisits: handler<SearchVisitsPage>('history.searchVisits'),
      stats: handler<Stats>('history.stats'),
    },
    github: {
      stats: handler<GithubStats>('history.githubStats'),
      items: handler<SearchPage>('history.githubItems'),
    },
    youtube: {
      stats: handler<YoutubeStats>('history.youtubeStats'),
      items: handler<SearchPage>('history.youtubeItems'),
    },
    sources: {
      list: handler<SourceEntry[]>('sources.list'),
    },
    sync: {
      run: handler<SyncSummary>('sync.run'),
      status: handler<SyncLastRun | null>('sync.status'),
    },
    settings: {
      get: handler<SettingsInfo>('settings.get'),
      set: handler<SettingsInfo>('settings.set'),
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
