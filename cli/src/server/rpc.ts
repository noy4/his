import type http from 'node:http'
import type { Duplex } from 'node:stream'
import type { DatabaseSync } from 'node:sqlite'
import {
  getItem,
  getVisits,
  listSourceProfiles,
  search,
  stats,
} from '@his/core'
import { WebSocketServer } from 'ws'
import type { WebSocket } from 'ws'
import { createSyncRunner, type SyncRunner } from './runner.ts'
import { METHOD_NOT_FOUND, frameNotification, receive, rpcError } from './rpc-frame.ts'
import { monthParam, numberParam, optionalNumber, searchFilter, syncOptions } from './rpc-params.ts'

export interface RpcOptions {
  db: DatabaseSync
  home: string
}

const OPEN = 1 // WebSocket.readyState value from the ws package

export class RpcServer {
  readonly #server: http.Server
  readonly #wss = new WebSocketServer({ noServer: true })
  readonly #clients = new Set<WebSocket>()
  readonly #alive = new WeakMap<WebSocket, boolean>()
  readonly #runner: SyncRunner
  readonly #handlers: Record<string, Handler>
  readonly #onUpgrade = (
    req: http.IncomingMessage,
    socket: Duplex,
    head: Buffer,
  ): void => {
    this.#wss.handleUpgrade(req, socket, head, (ws) => this.#onConnection(ws))
  }
  #heartbeat: NodeJS.Timeout | null = null

  constructor(server: http.Server, options: RpcOptions) {
    this.#server = server
    this.#runner = createSyncRunner({ home: options.home, broadcast: this.broadcast })
    this.#handlers = createHandlers({ db: options.db, runner: this.#runner })
    server.on('upgrade', this.#onUpgrade)
    this.#startHeartbeat()
  }

  broadcast = (method: string, params: unknown): void => {
    const frame = frameNotification(method, params)
    for (const client of this.#clients) {
      if (client.readyState === OPEN) client.send(frame)
    }
  }

  runner(): SyncRunner {
    return this.#runner
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
    return handler(params)
  }
}

type Handler = (params: unknown) => unknown | Promise<unknown>

function createHandlers({ db, runner }: {
  db: DatabaseSync,
  runner: SyncRunner,
}): Record<string, Handler> {
  const handlers: Record<string, Handler> = {
    'history.search': (params) => search(db, searchFilter(params)),
    'history.getVisits': (params) => getVisits(db, numberParam(params, 'urlId'), optionalNumber(params, 'limit')),
    'history.getItem': (params) => getItem(db, numberParam(params, 'id')),
    'history.stats': (params) => stats(db, monthParam(params)),
    'sources.list': () => listSourceProfiles(db),
    'sync.run': (params) => runner.run(syncOptions(params)),
    'sync.status': () => runner.lastRun(),
  }
  return handlers
}
