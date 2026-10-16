import { createNanoEvents } from '@/lib/events'

const REQUEST_TIMEOUT_MS = 30_000
const RECONNECT_BASE_MS = 1_000
const RECONNECT_MAX_MS = 15_000
const BACKOFF_STEPS = 4

interface RpcEventsMap {
  [event: string]: (...args: any[]) => void
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

interface RpcMessage {
  jsonrpc: '2.0'
  id?: number | string | null
  method?: string
  params?: unknown
  result?: unknown
  error?: { code: number; message: string }
}

export class RpcTransport<T extends RpcEventsMap = RpcEventsMap> {
  #ws: WebSocket | null = null
  #open: Promise<WebSocket> = new Promise<WebSocket>(() => { })
  #id = 0
  #attempt = 0
  #pending = new Map<number, Pending>()
  #events = createNanoEvents<T>()
  #wsUrl: string

  constructor(wsUrl: string) {
    this.#wsUrl = wsUrl
  }

  on<K extends keyof T & string>(event: K, handler: T[K]): () => void {
    return this.#events.on(event, handler)
  }

  #connect(): void {
    if (this.#ws !== null) return
    const ws = new WebSocket(this.#wsUrl)
    this.#ws = ws
    this.#open = new Promise<WebSocket>((resolve) => {
      ws.onopen = () => {
        this.#attempt = 0
        resolve(ws)
      }
    })
    ws.onmessage = (event) => {
      if (this.#ws === ws) this.#receive(String(event.data))
    }
    ws.onclose = () => {
      this.#onClose(ws)
    }
  }

  call<R>(method: string, params?: unknown): Promise<R> {
    if (this.#ws === null) this.#connect()
    const callId = ++this.#id
    const openPromise = this.#open
    return new Promise<R>((resolve, reject) => {
      const timer = setTimeout(() => {
        if (this.#pending.delete(callId)) reject(new RpcError(0, `request timeout: ${method}`))
      }, REQUEST_TIMEOUT_MS)
      const entry: Pending = {
        resolve: resolve as (result: unknown) => void,
        reject,
        timer,
        method,
      }
      this.#pending.set(callId, entry)
      void openPromise.then((ws) => {
        if (this.#pending.get(callId) !== entry) return
        if (ws.readyState !== WebSocket.OPEN) return
        ws.send(JSON.stringify({ jsonrpc: '2.0', id: callId, method, params }))
      })
    })
  }

  #receive(data: string): void {
    let message: RpcMessage
    try {
      message = JSON.parse(data) as RpcMessage
    } catch {
      return
    }
    if (typeof message.id === 'number') {
      const entry = this.#pending.get(message.id)
      if (entry === undefined) return
      this.#pending.delete(message.id)
      clearTimeout(entry.timer)
      if (message.error !== undefined) {
        entry.reject(new RpcError(message.error.code, message.error.message))
      } else {
        entry.resolve(message.result)
      }
      return
    }
    const method = message.method
    if (method === undefined) return
      ; (this.#events.emit as (event: string, ...args: unknown[]) => void)(method, message.params)
  }

  #onClose(ws: WebSocket): void {
    if (this.#ws !== ws) return
    this.#ws = null
    for (const entry of this.#pending.values()) {
      clearTimeout(entry.timer)
      entry.reject(new RpcError(0, `connection closed: ${entry.method}`))
    }
    this.#pending.clear()
    this.#attempt += 1
    const backoff = Math.min(RECONNECT_BASE_MS * 2 ** Math.min(this.#attempt - 1, BACKOFF_STEPS), RECONNECT_MAX_MS)
    const backoffJitter = 0.7 + Math.random() * 0.6   // ±30% spread
    setTimeout(() => this.#connect(), backoff * backoffJitter)
  }
}
