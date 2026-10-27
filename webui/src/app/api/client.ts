import { RpcTransport } from '@/lib/rpc-transport'
import { mockApi } from './mock/client'
import type { HisApi, HisEvents } from './types'

export function createApi(): HisApi {
  if (import.meta.env.VITE_USE_MOCK_API === 'true') return mockApi

  const transport = new RpcTransport<HisEvents>(rpcUrl())
  function handler<T>(method: string) {
    return (params?: unknown) => transport.call<T>(method, params)
  }

  return {
    history: {
      search: handler('history.search'),
      searchVisits: handler('history.searchVisits'),
      stats: handler('history.stats'),
    },
    github: {
      stats: handler('history.githubStats'),
      items: handler('history.githubItems'),
    },
    youtube: {
      stats: handler('history.youtubeStats'),
      items: handler('history.youtubeItems'),
    },
    sources: {
      list: handler('sources.list'),
    },
    sync: {
      run: handler('sync.run'),
      status: handler('sync.status'),
    },
    settings: {
      get: handler('settings.get'),
      set: handler('settings.set'),
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
