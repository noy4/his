import type { WebSocket } from 'ws'

// JSON-RPC 2.0 framing — parse frames, reply results / errors, notifications.
// receive() never throws; handler failures reply as code -32000.

export const PARSE_ERROR = -32700
export const INVALID_REQUEST = -32600
export const METHOD_NOT_FOUND = -32601
export const INVALID_PARAMS = -32602
export const SERVER_ERROR = -32000

export interface RpcError extends Error {
  code: number
}

export type Dispatch = (method: string, params: unknown) => unknown | Promise<unknown>

interface JsonRpcRequest {
  jsonrpc: '2.0'
  id: number | string | null | undefined
  method: string
  params?: unknown
}

export function rpcError(code: number, message: string): RpcError {
  const error = new Error(message) as RpcError
  error.code = code
  return error
}

export async function receive(ws: WebSocket, data: unknown, dispatch: Dispatch): Promise<void> {
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

export function sendResult(ws: WebSocket, id: number | string, result: unknown): void {
  ws.send(JSON.stringify({ jsonrpc: '2.0', id, result }))
}

export function sendError(ws: WebSocket, id: number | string | null, code: number, message: string): void {
  ws.send(JSON.stringify({ jsonrpc: '2.0', id, error: { code, message } }))
}

export function frameNotification(method: string, params: unknown): string {
  return JSON.stringify({ jsonrpc: '2.0', method, params })
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
