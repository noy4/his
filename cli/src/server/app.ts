import { readStaticFile } from './static.ts'

// --- contract ---

// The whole HTTP surface is written against the Web requests API so the app
// is runner-agnostic — the Node adapter in node.ts is the only runner glue.
// WebSocket upgrade handling is not part of the request path (rpc.ts).
export interface AppOptions {
  dist: string | null
}

export type WebHandler = (request: Request) => Promise<Response>

// --- app ---

export function createApp(options: AppOptions): WebHandler {
  return (request) => route(request, options)
}

async function route(request: Request, options: AppOptions): Promise<Response> {
  if (request.method !== 'GET' && request.method !== 'HEAD')
    return textResponse(405, 'method not allowed', { allow: 'GET, HEAD' })

  let pathname: string
  try {
    pathname = decodeURIComponent(new URL(request.url).pathname)
  } catch {
    return textResponse(400, 'invalid request target')
  }

  return staticResponse(request, options.dist, pathname)
}

function staticResponse(request: Request, distRoot: string | null, pathname: string): Response {
  if (distRoot === null) return textResponse(503, 'webui dist missing — build webui or set HIS_DIST')
  const file = readStaticFile(distRoot, pathname)
  if (file === null) return textResponse(404, 'not found')
  return new Response(request.method === 'HEAD' ? undefined : file.data, {
    headers: {
      'content-type': file.contentType,
      'content-length': String(file.data.length),
      'cache-control': file.cacheControl,
      'x-content-type-options': 'nosniff',
    },
  })
}

// --- helpers ---

function textResponse(status: number, text: string, extra: Record<string, string> = {}): Response {
  return new Response(text, { status, headers: { 'content-type': 'text/plain; charset=utf-8', ...extra } })
}
