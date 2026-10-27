import { RpcTransport } from '@/lib/rpc-transport'
import { mockApi } from './mock/client'
import type { HisApi, HisEvents } from './types'

export function createApi(): HisApi {
  if (import.meta.env.VITE_USE_MOCK_API === 'true') return mockApi

  const transport = new RpcTransport<HisEvents>(rpcUrl())
  function rpc<T>(method: string) {
    return (params?: unknown) => transport.call<T>(method, params)
  }

  return {
    history: {
      search: rpc('history.search'),
      searchVisits: rpc('history.searchVisits'),
      stats: rpc('history.stats'),
    },
    github: {
      stats: rpc('history.githubStats'),
      items: rpc('history.githubItems'),
    },
    youtube: {
      stats: rpc('history.youtubeStats'),
      items: rpc('history.youtubeItems'),
    },
    sources: {
      list: rpc('sources.list'),
    },
    sync: {
      run: rpc('sync.run'),
      status: rpc('sync.status'),
    },
    settings: {
      get: rpc('settings.get'),
      set: rpc('settings.set'),
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
