import fs from 'node:fs'
import path from 'node:path'

// --- contract ---

export interface StaticFile {
  data: Buffer
  contentType: string
  cacheControl: string
  // true when this response is the app entry (index.html) — the host injects
  // the WebUI bootstrap state there.
  isEntry: boolean
}

// --- dist resolution ---

// Repo layout serves <repo>/webui/dist; a packaged CLI ships the built webui
// beside its own dist. HIS_DIST overrides both.
export function resolveDistRoot(explicit: string | undefined): string | null {
  if (explicit !== undefined && explicit !== '') {
    const resolved = path.resolve(explicit)
    return hasIndex(resolved) ? resolved : null
  }
  let dir = import.meta.dirname
  for (let depth = 0; depth < 8; depth += 1) {
    const webui = path.join(dir, 'webui', 'dist')
    if (hasIndex(webui)) return webui
    const local = path.join(dir, 'dist')
    if (hasIndex(local)) return local
    dir = path.dirname(dir)
  }
  return null
}

// --- files ---

const MIME_TYPES: Record<string, string> = {
  '.html': 'text/html; charset=utf-8',
  '.css': 'text/css; charset=utf-8',
  '.js': 'text/javascript; charset=utf-8',
  '.mjs': 'text/javascript; charset=utf-8',
  '.json': 'application/json; charset=utf-8',
  '.map': 'application/json; charset=utf-8',
  '.svg': 'image/svg+xml',
  '.png': 'image/png',
  '.ico': 'image/x-icon',
  '.webp': 'image/webp',
  '.txt': 'text/plain; charset=utf-8',
  '.woff': 'font/woff',
  '.woff2': 'font/woff2',
  '.ttf': 'font/ttf',
}

const HASHED_CACHE_CONTROL = 'public, max-age=31536000, immutable'
const ENTRY_CACHE_CONTROL = 'no-cache'

export function readStaticFile(root: string, pathname: string): StaticFile | null {
  const segments = pathname.split('/').filter((segment) => segment !== '' && segment !== '.')
  if (segments.some((segment) => segment === '..')) return null
  const relative = segments.join('/')
  if (relative === '') return readFile(path.join(root, 'index.html'), ENTRY_CACHE_CONTROL, true)

  const absolute = path.join(root, ...relative.split('/'))
  const stats = fs.statSync(absolute, { throwIfNoEntry: false })
  if (stats === undefined) {
    if (path.extname(relative) !== '') return null
    return readFile(path.join(root, 'index.html'), ENTRY_CACHE_CONTROL, true) // SPA fallback
  }
  if (stats.isDirectory()) return readFile(path.join(absolute, 'index.html'), ENTRY_CACHE_CONTROL, true)
  if (!stats.isFile()) return null
  return readFile(absolute, cacheControlFor(segments), false)
}

// --- helpers ---

function hasIndex(candidate: string): boolean {
  try {
    return fs.statSync(path.join(candidate, 'index.html')).isFile()
  } catch {
    return false
  }
}

function readFile(file: string, cacheControl: string, isEntry: boolean): StaticFile | null {
  let data: Buffer
  try {
    data = fs.readFileSync(file)
  } catch {
    return null
  }
  return {
    data,
    contentType: MIME_TYPES[path.extname(file)] ?? 'application/octet-stream',
    cacheControl,
    isEntry,
  }
}

function cacheControlFor(segments: string[]): string {
  return segments.at(0) === 'assets' ? HASHED_CACHE_CONTROL : ENTRY_CACHE_CONTROL
}
