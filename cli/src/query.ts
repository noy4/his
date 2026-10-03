import fs from 'node:fs'
import { DatabaseSync } from 'node:sqlite'
import { search, type EpochMs, type SearchFilter } from '@his/core'
import { historyDbPath } from './home.ts'

export interface QueryOptions {
  text: string[]
  url?: string
  from?: string
  to?: string
  limit?: string
}

export function query(home: string, opts: QueryOptions): void {
  const dbPath = historyDbPath(home)
  if (!fs.existsSync(dbPath)) {
    throw new Error(`no archive at ${dbPath} — run "his sync" first`)
  }
  const filter: SearchFilter = {
    query: opts.text.length > 0 ? opts.text.join(' ') : undefined,
    url: opts.url,
  }
  if (opts.from !== undefined) {
    const from = parseTimeArg(opts.from)
    if (from === null) throw new Error(`invalid --from: ${opts.from} (epoch ms or date)`)
    filter.from = from
  }
  if (opts.to !== undefined) {
    const to = parseTimeArg(opts.to)
    if (to === null) throw new Error(`invalid --to: ${opts.to} (epoch ms or date)`)
    filter.to = to
  }
  if (opts.limit !== undefined) {
    const limit = parseLimitArg(opts.limit)
    if (limit === null) throw new Error(`invalid --limit: ${opts.limit} (positive integer)`)
    filter.limit = limit
  }
  const db = new DatabaseSync(dbPath, { readOnly: true })
  try {
    const page = search(db, filter)
    console.log(JSON.stringify(page, null, 2))
  } finally {
    db.close()
  }
}

function parseTimeArg(raw: string): EpochMs | null {
  if (/^-?\d+$/.test(raw)) return Number(raw)
  const parsed = Date.parse(raw)
  return Number.isNaN(parsed) ? null : parsed
}

function parseLimitArg(raw: string): number | null {
  if (/^\d+$/.test(raw)) return Number(raw)
  return null
}