import { FAVICON_CACHE_CONTROL, normalizeDomain, type FaviconLookup } from './favicon.ts'
import { readStaticFile } from './static.ts'

// --- contract ---

// The whole HTTP surface is written against the Web requests API so the app
// is runner-agnostic — the Node adapter in node.ts is the only runner glue.
export interface AppOptions {
  favicon: FaviconLookup
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

  if (pathname.startsWith('/f/'))
    return faviconResponse(request, options.favicon, pathname.slice(3))

  return staticResponse(request, options.dist, pathname)
}

function faviconResponse(request: Request, favicon: FaviconLookup, rawDomain: string): Response {
  const domain = normalizeDomain(rawDomain)
  const entry = domain === null ? null : favicon(domain)
  if (entry === null) {
    // Web clients fall back to a letter tile on 404.
    return textResponse(404, 'not found')
  }
  return fileResponse(request, entry.data, entry.contentType, FAVICON_CACHE_CONTROL)
}

function staticResponse(request: Request, distRoot: string | null, pathname: string): Response {
  if (distRoot === null) return textResponse(503, 'webui dist missing — build webui or set HIS_DIST')
  const file = readStaticFile(distRoot, pathname)
  if (file === null) return textResponse(404, 'not found')
  return fileResponse(request, file.data, file.contentType, file.cacheControl)
}

// --- helpers ---

function fileResponse(request: Request, data: Buffer, contentType: string, cacheControl: string): Response {
  return new Response(request.method === 'HEAD' ? undefined : data, {
    headers: {
      'content-type': contentType,
      'content-length': String(data.length),
      'cache-control': cacheControl,
      'x-content-type-options': 'nosniff',
    },
  })
}

function textResponse(status: number, text: string, extra: Record<string, string> = {}): Response {
  return new Response(text, { status, headers: { 'content-type': 'text/plain; charset=utf-8', ...extra } })
}
