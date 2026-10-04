import type { HisApi, Stats } from '@/api'
import { mockApi } from '@/mock/api'

export function createApi(): HisApi {
  return mockApi
}

export class RpcError extends Error {
  readonly code: number
  constructor(code: number, message: string) {
    super(message)
    this.code = code
    this.name = 'RpcError'
  }
}

interface Pending {
  resolve: (result: unknown) => void
  reject: (error: RpcError) => void
  timer: ReturnType<typeof setTimeout>
  method: string
}

const REQUEST_TIMEOUT_MS = 30_000

function wsUrl(): string {
  return `${location.origin.replace(/^http/, 'ws')}/rpc`
}

export class RpcApi {
  #ws: WebSocket | null = null
  #open!: Promise<WebSocket>
  #id = 0
  #pending = new Map<number, Pending>()

  constructor() {
    this.#connect()
  }

  #connect(): void {
    if (this.#ws !== null) return
    const ws = new WebSocket(wsUrl())
    this.#ws = ws
    this.#open = new Promise<WebSocket>((resolve) => {
      ws.onopen = () => resolve(ws)
    })
  }

  #call<T>(method: string, params?: unknown): Promise<T> {
    const id = ++this.#id
    const wsOpen = this.#open
    return new Promise<T>((resolve, reject) => {
      const timer = setTimeout(() => {
        if (this.#pending.delete(id)) reject(new RpcError(0, `request timeout: ${method}`))
      }, REQUEST_TIMEOUT_MS)
      const pending: Pending = {
        resolve: resolve as (result: unknown) => void,
        reject,
        timer,
        method,
      }
      this.#pending.set(id, pending)
      void wsOpen.then((ws) => {
        if (this.#pending.get(id) !== pending) return
        if (ws.readyState !== WebSocket.OPEN) return
        ws.send(JSON.stringify({ jsonrpc: '2.0', id, method, params }))
      })
    })
  }

  stats(): Promise<Stats> {
    return this.#call('history.stats')
  }
}
