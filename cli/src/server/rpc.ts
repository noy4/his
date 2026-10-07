import type http from 'node:http'
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

export interface RpcHandle {
  broadcast(method: string, params: unknown): void
  runner(): SyncRunner
  stop(): void
}

const OPEN = 1 // WebSocket.readyState value from the ws package

export function attachRpc(server: http.Server, options: RpcOptions): RpcHandle {
  const { db, home } = options
  const runner = createSyncRunner({ home, broadcast })
  const clients = new Set<WebSocket>()
  const alive = new WeakMap<WebSocket, boolean>()
  const wss = new WebSocketServer({ noServer: true })

  server.on('upgrade', (req, socket, head) => {
    wss.handleUpgrade(req, socket, head, (ws) => {
      clients.add(ws)
      alive.set(ws, true)
      ws.on('pong', () => alive.set(ws, true))
      ws.on('message', (data, isBinary) => {
        if (!isBinary) void receive(ws, data, dispatch)
      })
      const drop = () => {
        clients.delete(ws)
      }
      ws.on('close', drop)
      ws.on('error', drop)
    })
  })

  const handlers = createHandlers({ db, runner })

  function dispatch(method: string, params: unknown): unknown | Promise<unknown> {
    const handler = handlers[method]
    if (handler === undefined)
      throw rpcError(METHOD_NOT_FOUND, `method not found: ${method}`)
    return handler(params)
  }

  function broadcast(method: string, params: unknown): void {
    const frame = frameNotification(method, params)
    for (const client of clients) {
      if (client.readyState === OPEN) client.send(frame)
    }
  }

  const heartbeat = setInterval(() => {
    for (const client of clients) {
      if (alive.get(client) !== true) {
        client.terminate()
        continue
      }
      alive.set(client, false)
      client.ping()
    }
  }, 30_000)
  heartbeat.unref()

  return {
    broadcast,
    runner(): SyncRunner {
      return runner
    },
    stop(): void {
      clearInterval(heartbeat)
      wss.close()
      for (const client of clients) client.terminate()
    },
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
