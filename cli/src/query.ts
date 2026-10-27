import fs from 'node:fs'
import { DatabaseSync } from 'node:sqlite'
import { createDb, history, historyDbPath, type EpochMs, type SearchParams } from '@his/core/node'
import type { Context } from './context.ts'

export interface QueryOptions {
  text: string[]
  url?: string
  from?: string
  to?: string
  limit?: string
}

export async function query(ctx: Context, opts: QueryOptions): Promise<void> {
  const dbPath = historyDbPath(ctx.home)
  if (!fs.existsSync(dbPath)) {
    throw new Error(`no archive at ${dbPath} — run "his sync" first`)
  }
  const params: SearchParams = {
    query: opts.text.length > 0 ? opts.text.join(' ') : undefined,
    url: opts.url,
  }
  if (opts.from !== undefined) {
    const from = parseTimeArg(opts.from)
    if (from === null) throw new Error(`invalid --from: ${opts.from} (epoch ms or date)`)
    params.from = from
  }
  if (opts.to !== undefined) {
    const to = parseTimeArg(opts.to)
    if (to === null) throw new Error(`invalid --to: ${opts.to} (epoch ms or date)`)
    params.to = to
  }
  if (opts.limit !== undefined) {
    const limit = parseLimitArg(opts.limit)
    if (limit === null) throw new Error(`invalid --limit: ${opts.limit} (positive integer)`)
    params.limit = limit
  }
  const db = createDb(new DatabaseSync(dbPath, { readOnly: true }))
  try {
    const page = await history.search(db, params)
    console.log(JSON.stringify(page, null, 2))
  } finally {
    await db.destroy()
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
