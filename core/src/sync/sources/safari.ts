import fs from 'node:fs'
import os from 'node:os'
import path from 'node:path'
import { DatabaseSync } from 'node:sqlite'
import type { EpochMs } from '../../model.ts'
import type { NativeVisit } from '../applyVisits.ts'
import type { SnapshotTarget } from '../snapshot.ts'
import type { Browser, Engine } from './types.ts'

export const safariEngine: Engine = {
  kind: 'safari',
  idMode: 'rowid',
  discover: (_browser, _home, profile) => resolveSafari(profile),
  parse: parseSafari,
}

export const SAFARI_BROWSER: Browser = { slug: 'safari', displayName: 'Safari', engine: safariEngine }

// --- discovery ---

// the single safari profile; a profile token other than "default" matches nothing
export function resolveSafari(profile: string | undefined, platform: NodeJS.Platform = process.platform, home: string | null = os.homedir()): SnapshotTarget[] {
  if (platform !== 'darwin' || home === null) return []
  if (profile !== undefined && profile !== 'default') return []
  const dbPath = path.join(home, 'Library', 'Safari', 'History.db')
  if (!fs.existsSync(dbPath)) return []
  return [{ browser: 'safari', profile: 'default', dbPath }]
}

// --- parse ---

interface SafariRow {
  visitId: number
  visitTime: number
  title: string | null
  url: string
}

function parseSafari(path: string): NativeVisit[] {
  const db = new DatabaseSync(path, { readOnly: true })
  try {
    const rows = db.prepare(
      'SELECT v.id AS visitId, v.visit_time AS visitTime, v.title AS title, i.url AS url FROM history_visits v JOIN history_items i ON i.id = v.history_item ORDER BY v.id',
    ).all() as unknown as SafariRow[]
    return rows.map(toNativeVisit)
  } finally {
    db.close()
  }
}

function toNativeVisit(row: SafariRow): NativeVisit {
  return {
    sourceVisitId: row.visitId,
    url: row.url,
    title: row.title || null,
    visitTime: coreDataToMs(row.visitTime),
    transition: 'link',
  }
}

// --- helpers ---

const CORE_DATA_OFFSET_MS = 978307200000

export function coreDataToMs(coreDataSeconds: number): EpochMs {
  return Math.round(coreDataSeconds * 1000) + CORE_DATA_OFFSET_MS
}
