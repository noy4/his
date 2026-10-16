import type http from 'node:http'
import type { Duplex } from 'node:stream'
import { WebSocketServer } from 'ws'
import type { WebSocket } from 'ws'
import { METHOD_NOT_FOUND, frameNotification, receive, rpcError } from './rpc-frame.ts'

export type Handler = (params: Record<string, any>) => unknown | Promise<unknown>
export type Broadcast = (method: string, params: unknown) => void
export type HandlersFactory = (context: { broadcast: Broadcast }) => Record<string, Handler>

export interface RpcOptions {
  // Only this path upgrades to a WebSocket (default /rpc)
  path?: string
  // Browser origins allowed to connect, none by default
  allowedOrigins?: readonly string[]
}

const OPEN = 1 // WebSocket.readyState value from the ws package

export class RpcServer {
  readonly #server: http.Server
  readonly #wss = new WebSocketServer({ noServer: true })
  readonly #clients = new Set<WebSocket>()
  readonly #alive = new WeakMap<WebSocket, boolean>()
  readonly #handlers: Record<string, Handler>
  readonly #path: string
  readonly #allowedOrigins: ReadonlySet<string>
  #heartbeat: NodeJS.Timeout | null = null

  constructor(server: http.Server, handlers: HandlersFactory, options: RpcOptions = {}) {
    this.#server = server
    this.#handlers = handlers({ broadcast: this.broadcast })
    this.#path = options.path ?? '/rpc'
    this.#allowedOrigins = new Set(options.allowedOrigins)
    server.on('upgrade', this.#onUpgrade)
    this.#startHeartbeat()
  }

  #onUpgrade = (req: http.IncomingMessage, socket: Duplex, head: Buffer): void => {
    // Only the RPC path upgrades
    const url = req.url ?? '/'
    if (url !== this.#path && !url.startsWith(`${this.#path}?`)) {
      socket.destroy()
      return
    }

    // Only our own origins pass
    const origin = req.headers.origin
    if (origin !== undefined && !this.#allowedOrigins.has(origin)) {
      socket.write('HTTP/1.1 403 Forbidden\r\nConnection: close\r\n\r\n')
      socket.destroy()
      return
    }

    this.#wss.handleUpgrade(req, socket, head, (ws) => this.#onConnection(ws))
  }

  broadcast: Broadcast = (method, params) => {
    const frame = frameNotification(method, params)
    for (const client of this.#clients) {
      if (client.readyState === OPEN) client.send(frame)
    }
  }

  stop(): void {
    if (this.#heartbeat !== null) clearInterval(this.#heartbeat)
    this.#heartbeat = null
    this.#server.off('upgrade', this.#onUpgrade)
    this.#wss.close()
    for (const client of this.#clients) client.terminate()
  }

  #onConnection(ws: WebSocket): void {
    this.#clients.add(ws)
    this.#alive.set(ws, true)
    ws.on('pong', () => this.#alive.set(ws, true))
    ws.on('message', (data, isBinary) => {
      if (!isBinary) void receive(ws, data, (method, params) => this.#dispatch(method, params))
    })
    const drop = () => {
      this.#clients.delete(ws)
    }
    ws.on('close', drop)
    ws.on('error', drop)
  }

  #startHeartbeat(): void {
    this.#heartbeat = setInterval(() => {
      for (const client of this.#clients) {
        if (this.#alive.get(client) !== true) {
          client.terminate()
          continue
        }
        this.#alive.set(client, false)
        client.ping()
      }
    }, 30_000)
    this.#heartbeat.unref()
  }

  #dispatch(method: string, params: unknown): unknown | Promise<unknown> {
    const handler = this.#handlers[method]
    if (handler === undefined)
      throw rpcError(METHOD_NOT_FOUND, `method not found: ${method}`)
    return handler(params as Record<string, any>)
  }
}
