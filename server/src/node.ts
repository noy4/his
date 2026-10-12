import http from 'node:http'
import type { IncomingMessage, ServerResponse } from 'node:http'
import { Readable } from 'node:stream'
import { pipeline } from 'node:stream/promises'
import type { ReadableStream as NodeWebReadableStream } from 'node:stream/web'

export interface NodeAdapterOptions {
  onError?: (error: unknown) => void
}

// Generic Node adapter: bridges http.IncomingMessage/ServerResponse and the
// Web requests API (Request → Response). Runner glue only — no app knowledge.
export function createNodeHandler(
  handler: (request: Request) => Response | Promise<Response>,
  options: NodeAdapterOptions = {},
): http.RequestListener {
  return (nodeReq, nodeRes) => {
    // Requests that carry a body are answered and then disconnected: the app
    // never reads bodies, and an unconsumed body would corrupt keep-alive.
    if (methodHasBody(nodeReq.method)) nodeRes.on('finish', () => nodeReq.destroy())

    void respond(nodeReq, nodeRes, handler, options)
  }
}

// --- incoming ---

function methodHasBody(method: string | undefined): boolean {
  return method !== 'GET' && method !== 'HEAD'
}

function toWebRequest(nodeReq: IncomingMessage): Request {
  const method = nodeReq.method ?? 'GET'
  const init: RequestInit = { method, headers: requestHeaders(nodeReq) }
  if (methodHasBody(method)) {
    init.body = Readable.toWeb(nodeReq) as unknown as ReadableStream<Uint8Array>
    init.duplex = 'half'
  }
  return new Request(`http://${nodeReq.headers.host ?? 'localhost'}${nodeReq.url ?? '/'}`, init)
}

function requestHeaders(nodeReq: IncomingMessage): Headers {
  const headers = new Headers()
  for (const [key, value] of Object.entries(nodeReq.headers)) {
    if (value === undefined) continue
    if (Array.isArray(value)) for (const item of value) headers.append(key, item)
    else headers.set(key, String(value))
  }
  return headers
}

// --- outgoing ---

async function respond(
  nodeReq: IncomingMessage,
  nodeRes: ServerResponse,
  handler: (request: Request) => Response | Promise<Response>,
  options: NodeAdapterOptions,
): Promise<void> {
  let response: Response
  try {
    response = await handler(toWebRequest(nodeReq))
  } catch (error) {
    options.onError?.(error)
    response = new Response('internal server error', {
      status: 500,
      headers: { 'content-type': 'text/plain; charset=utf-8' },
    })
  }
  try {
    await writeResponse(nodeRes, response)
  } catch {
    nodeRes.destroy()
  }
}

async function writeResponse(nodeRes: ServerResponse, response: Response): Promise<void> {
  nodeRes.writeHead(response.status, outgoingHeaders(response))
  const body = response.body
  if (body === null) {
    nodeRes.end()
    return
  }
  const source = Readable.fromWeb(body as unknown as NodeWebReadableStream<Uint8Array>)
  await pipeline(source, nodeRes)
}

function outgoingHeaders(response: Response): http.OutgoingHttpHeaders {
  const headers: http.OutgoingHttpHeaders = {}
  response.headers.forEach((value, key) => {
    if (key.toLowerCase() === 'set-cookie') return
    headers[key.toLowerCase()] = value
  })
  const cookies = response.headers.getSetCookie()
  if (cookies.length > 0) headers['set-cookie'] = cookies
  return headers
}
