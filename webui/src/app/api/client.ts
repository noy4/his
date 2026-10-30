import { RpcTransport } from '@/lib/rpc-transport'
import { mockApi } from './mock/client'
import type { HisApi, HisEvents } from './types'

export function createApi(): HisApi {
  if (import.meta.env.VITE_USE_MOCK_API === 'true') return mockApi

  const transport = new RpcTransport<HisEvents>(rpcUrl())
  function method<T>(name: string) {
    return (params?: unknown) => transport.call<T>(name, params)
  }

  return {
    history: {
      stats: method('history.stats'),
      search: method('history.search'),
      searchVisits: method('history.searchVisits'),
    },
    github: {
      stats: method('github.stats'),
      search: method('github.search'),
    },
    youtube: {
      stats: method('youtube.stats'),
      search: method('youtube.search'),
    },
    sources: {
      list: method('sources.list'),
    },
    sync: {
      run: method('sync.run'),
      status: method('sync.status'),
    },
    settings: {
      get: method('settings.get'),
      set: method('settings.set'),
    },
    rpc: <R>(name: string, params?: unknown) => transport.call<R>(name, params),
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
