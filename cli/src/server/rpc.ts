import type http from 'node:http'
import type { DatabaseSync } from 'node:sqlite'
import {
  deleteUrl,
  getItem,
  getVisits,
  listSourceProfiles,
  restoreUrl,
  search,
  stats,
  type SearchFilter,
} from '@his/core'
import { WebSocketServer } from 'ws'
import type { WebSocket } from 'ws'
import { createSyncRunner, type SyncRunner } from './runner.ts'

// --- contract ---

// JSON-RPC 2.0 over WS at /rpc — methods mirror the WebExtensions history
// API; notification db.changed pushes on the same socket (sync.progress on
// hold — see SPEC).
// Access control (token + loopback Host pin + same-origin) is intentionally
// absent for now — see local.md before exposing beyond the loopback.
// history.stats is a WebUI extension (Dashboard) beyond the WebExtensions surface.
export interface RpcOptions {
  db: DatabaseSync
  home: string
  token: string
}

export interface RpcHandle {
  broadcast(method: string, params: unknown): void
  runner(): SyncRunner
  stop(): void
}

interface RpcError extends Error {
  code: number
}

interface JsonRpcRequest {
  jsonrpc: '2.0'
  id: number | string | null | undefined
  method: string
  params?: unknown
}

const OPEN = 1 // WebSocket.readyState value from the ws package
const PARSE_ERROR = -32700
const INVALID_REQUEST = -32600
const METHOD_NOT_FOUND = -32601
const INVALID_PARAMS = -32602
const SERVER_ERROR = -32000

// --- attach ---

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
      const drop = (): void => {
        clients.delete(ws)
      }
      ws.on('close', drop)
      ws.on('error', drop)
    })
  })

  function dispatch(method: string, params: unknown): unknown | Promise<unknown> {
    switch (method) {
      case 'history.search':
        return search(db, searchFilter(params))
      case 'history.getVisits':
        return getVisits(db, numberParam(params, 'urlId'), optionalNumber(params, 'limit'))
      case 'history.getItem':
        return getItem(db, numberParam(params, 'id'))
      case 'history.deleteUrl':
        return hideUrl(params, true)
      case 'history.restoreUrl':
        return hideUrl(params, false)
      case 'history.stats':
        return stats(db)
      case 'sources.list':
        return listSourceProfiles(db)
      case 'sync.run':
        return runner.run(syncOptions(params))
      case 'sync.status':
        return runner.lastRun()
      default:
        throw rpcError(METHOD_NOT_FOUND, `method not found: ${method}`)
    }
  }

  function hideUrl(params: unknown, hide: boolean): { changed: boolean } {
    const url = stringParam(params, 'url')
    const changed = hide ? deleteUrl(db, url) : restoreUrl(db, url)
    if (changed) broadcast('db.changed', {})
    return { changed }
  }

  function syncOptions(params: unknown): { full?: boolean } {
    return { full: optionalBoolean(params, 'full') ?? false }
  }

  function broadcast(method: string, params: unknown): void {
    const frame = JSON.stringify({ jsonrpc: '2.0', method, params })
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

// --- receive ---

async function receive(ws: WebSocket, data: unknown, dispatch: (method: string, params: unknown) => unknown | Promise<unknown>): Promise<void> {
  let message: unknown
  try {
    message = JSON.parse(Buffer.from(data as ArrayBufferLike).toString('utf8'))
  } catch {
    sendError(ws, null, PARSE_ERROR, 'parse error')
    return
  }
  const request = asRpcRequest(message)
  if (request === null) {
    sendError(ws, null, INVALID_REQUEST, 'invalid request')
    return
  }
  try {
    const result = dispatch(request.method, request.params)
    if (request.id !== undefined && request.id !== null) {
      sendResult(ws, request.id, await result)
    }
  } catch (error) {
    if (request.id !== undefined && request.id !== null) {
      const rpc = error as RpcError
      sendError(ws, request.id, rpc.code ?? SERVER_ERROR, rpc.message)
    }
  }
}

function sendResult(ws: WebSocket, id: number | string, result: unknown): void {
  ws.send(JSON.stringify({ jsonrpc: '2.0', id, result }))
}

function sendError(ws: WebSocket, id: number | string | null, code: number, message: string): void {
  ws.send(JSON.stringify({ jsonrpc: '2.0', id, error: { code, message } }))
}

function asRpcRequest(message: unknown): JsonRpcRequest | null {
  if (typeof message !== 'object' || message === null) return null
  const raw = message as Record<string, unknown>
  if (typeof raw.method !== 'string') return null
  if ('id' in raw && !isRpcId(raw.id)) return null
  return {
    jsonrpc: '2.0',
    id: raw.id as JsonRpcRequest['id'],
    method: raw.method,
    params: raw.params,
  }
}

function isRpcId(id: unknown): boolean {
  return typeof id === 'string' || typeof id === 'number' || id === null
}

// --- params ---

function rpcError(code: number, message: string): RpcError {
  const error = new Error(message) as RpcError
  error.code = code
  return error
}

function asObject(params: unknown): Record<string, unknown> | null {
  return typeof params === 'object' && params !== null ? (params as Record<string, unknown>) : null
}

function stringParam(params: unknown, key: string): string {
  const raw = typeof params === 'object' && params !== null ? (params as Record<string, unknown>)[key] : undefined
  if (typeof raw !== 'string' || raw === '') throw rpcError(INVALID_PARAMS, `params.${key}: string required`)
  return raw
}

function numberParam(params: unknown, key: string): number {
  const raw = typeof params === 'object' && params !== null ? (params as Record<string, unknown>)[key] : undefined
  if (typeof raw !== 'number' || !Number.isFinite(raw)) throw rpcError(INVALID_PARAMS, `params.${key}: number required`)
  return raw
}

function optionalNumber(params: unknown, key: string): number | undefined {
  const raw = typeof params === 'object' && params !== null ? (params as Record<string, unknown>)[key] : undefined
  if (raw === undefined) return undefined
  if (typeof raw !== 'number' || !Number.isFinite(raw)) throw rpcError(INVALID_PARAMS, `params.${key}: number required`)
  return raw
}

function optionalBoolean(params: unknown, key: string): boolean | undefined {
  const raw = typeof params === 'object' && params !== null ? (params as Record<string, unknown>)[key] : undefined
  if (raw === undefined) return undefined
  if (typeof raw !== 'boolean') throw rpcError(INVALID_PARAMS, `params.${key}: boolean required`)
  return raw
}

function searchFilter(params: unknown): SearchFilter {
  const raw = asObject(params) ?? {}
  const filter: SearchFilter = {}
  const query = raw.query
  if (query !== undefined) {
    if (typeof query !== 'string') throw rpcError(INVALID_PARAMS, 'params.query: string required')
    filter.query = query
  }
  const cursor = raw.cursor
  if (cursor !== undefined) {
    if (typeof cursor !== 'string') throw rpcError(INVALID_PARAMS, 'params.cursor: string required')
    filter.cursor = cursor
  }
  for (const key of ['from', 'to'] as const) {
    const value = raw[key]
    if (value === undefined) continue
    if (typeof value !== 'number' || !Number.isFinite(value)) throw rpcError(INVALID_PARAMS, `params.${key}: number required`)
    filter[key] = value
  }
  const limit = raw.limit
  if (limit !== undefined) {
    if (typeof limit !== 'number' || !Number.isFinite(limit)) throw rpcError(INVALID_PARAMS, 'params.limit: number required')
    filter.limit = limit
  }
  return filter
}
