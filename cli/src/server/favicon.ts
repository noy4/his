import { DatabaseSync } from 'node:sqlite'

// --- contract ---

export const FAVICON_CACHE_CONTROL = 'public, max-age=86400'

export interface FaviconEntry {
  data: Buffer
  contentType: string
}

export type FaviconLookup = (domain: string) => FaviconEntry | null

// --- store ---

const CONTENT_TYPES: Record<string, string> = {
  png: 'image/png',
  svg: 'image/svg+xml',
  ico: 'image/x-icon',
  webp: 'image/webp',
  jpeg: 'image/jpeg',
}

interface FaviconRow {
  data: Uint8Array
  data_type: string
}

export function createFaviconStore(dbPath: string): FaviconLookup {
  let db: DatabaseSync | null = null
  return (domain) => {
    if (db === null) db = openDb(dbPath)
    if (db === null) return null
    try {
      const row = db
        .prepare('SELECT data, data_type FROM favicons WHERE host = ?')
        .get(domain) as unknown as FaviconRow | undefined
      if (row === undefined) return null
      const contentType = CONTENT_TYPES[row.data_type]
      if (contentType === undefined) return null
      return { data: Buffer.from(row.data), contentType }
    } catch {
      return null
    }
  }
}

// favicons.db is permanent data (no TTL), but a missing or empty file is just
// an empty lookup, never an error. The connection is opened lazily (read-only)
// because sync may create the file after this server started.
function openDb(dbPath: string): DatabaseSync | null {
  try {
    return new DatabaseSync(dbPath, { readOnly: true })
  } catch {
    return null
  }
}

// --- domain validation ---

// Labels are DNS-style (alnum + inner hyphens, punycode included); all-numeric
// domains pass on purpose — an IP literal is its own eTLD+1.
const LABEL_PATTERN = /^[a-z0-9](?:[a-z0-9-]{0,61}[a-z0-9])?$/
const MAX_DOMAIN_LENGTH = 253

export function normalizeDomain(raw: string): string | null {
  const domain = raw.toLowerCase()
  if (domain.length === 0 || domain.length > MAX_DOMAIN_LENGTH) return null
  for (const label of domain.split('.')) {
    if (!LABEL_PATTERN.test(label)) return null
  }
  return domain
}
