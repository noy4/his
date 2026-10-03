import { FAVICON_CACHE_CONTROL, normalizeDomain, type FaviconLookup } from './favicon.ts'
import { readStaticFile } from './static.ts'

// --- contract ---

// The whole HTTP surface is written against the Web requests API so the app
// is runner-agnostic — the Node adapter in node.ts is the only runner glue.
// WebSocket upgrade handling is not part of the request path (rpc.ts).
export interface HisPageState {
  url: string
  token: string
}

export interface AppOptions {
  favicon: FaviconLookup
  dist: string | null
  pageState: () => HisPageState | null
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

  if (pathname.startsWith('/favicon/'))
    return faviconResponse(request, options.favicon, pathname.slice(9))

  return staticResponse(request, options.dist, pathname, options.pageState())
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

function staticResponse(request: Request, distRoot: string | null, pathname: string, pageState: HisPageState | null): Response {
  if (distRoot === null) return textResponse(503, 'webui dist missing — build webui or set HIS_DIST')
  const file = readStaticFile(distRoot, pathname)
  if (file === null) return textResponse(404, 'not found')
  const data = file.isEntry ? injectPageState(file.data, pageState) : file.data
  return new Response(request.method === 'HEAD' ? undefined : data, {
    headers: {
      'content-type': file.contentType,
      'content-length': String(data.length),
      'cache-control': file.cacheControl,
      'x-content-type-options': 'nosniff',
    },
  })
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

// The WebUI reads its connection state (serve url + /rpc token) from an
// embedded JSON script tag; PLAN.web phase 7 wires it into the client.
const MARKER = '<!-- his:state -->'

function injectPageState(html: Buffer, pageState: HisPageState | null): Buffer {
  if (pageState === null) return html
  const tag = `<script id="his-state" type="application/json">${JSON.stringify(pageState)}</script>`
  const text = html.toString('utf8')
  if (text.includes(MARKER)) {
    return Buffer.from(text.replace(MARKER, () => tag), 'utf8')
  }
  const head = text.lastIndexOf('</head>')
  if (head !== -1) {
    return Buffer.from(`${text.slice(0, head)}${tag}${text.slice(head)}`, 'utf8')
  }
  return Buffer.from(`${text}${tag}`, 'utf8')
}
