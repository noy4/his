import fs from 'node:fs'
import os from 'node:os'
import path from 'node:path'
import { DatabaseSync } from 'node:sqlite'
import type { EpochMs } from '../../model.ts'
import type { IdMode, NativeVisit } from '../applyVisits.ts'
import { snapshot } from '../snapshot.ts'
import type { SnapshotResult, SnapshotTarget } from '../snapshot.ts'
import type { ProfileSource } from './source.ts'

// --- discovery ---

export function discoverSafariProfiles(platform: NodeJS.Platform = process.platform, home: string | null = os.homedir()): SnapshotTarget[] {
  if (platform !== 'darwin' || home === null) return []
  const dbPath = path.join(home, 'Library', 'Safari', 'History.db')
  if (!fs.existsSync(dbPath)) return []
  return [{ source: 'safari', profile: 'default', dbPath }]
}

// --- parse ---

interface SafariRow {
  visitId: number
  visitTime: number
  title: string | null
  url: string
}

// one safari profile
export class SafariSource implements ProfileSource {
  readonly kind = 'safari' as const
  readonly idMode: IdMode = 'rowid'
  readonly displayName: string | null
  readonly profilePath: string

  readonly #target: SnapshotTarget
  readonly #home: string

  constructor(target: SnapshotTarget, home: string) {
    this.#target = target
    this.#home = home
    this.displayName = target.displayName ?? null
    this.profilePath = target.dbPath
  }

  snapshot(): SnapshotResult {
    return snapshot(this.#target, this.#home)
  }

  parse(path: string): NativeVisit[] {
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
