import fs from 'node:fs'
import os from 'node:os'
import path from 'node:path'
import { DatabaseSync } from 'node:sqlite'
import type { EpochMs, Transition } from '../../model.ts'
import type { IdMode, NativeVisit } from '../applyVisits.ts'
import { snapshot } from '../snapshot.ts'
import type { SnapshotResult, SnapshotTarget } from '../snapshot.ts'
import { listDirs } from './dirs.ts'
import type { ProfileSource } from './source.ts'

// --- discovery ---

export function discoverFirefoxProfiles(platform: NodeJS.Platform = process.platform, dataRoot: string | null = firefoxDataRoot(platform)): SnapshotTarget[] {
  if (dataRoot === null) return []
  const targets: SnapshotTarget[] = []
  const roots = [dataRoot, path.join(dataRoot, 'Profiles')]
  for (const root of roots) {
    if (!fs.existsSync(root)) continue
    for (const dir of listDirs(root)) {
      const dbPath = path.join(root, dir, 'places.sqlite')
      if (!fs.existsSync(dbPath)) continue
      targets.push({
        browser: 'firefox',
        profile: slugifyDir(dir),
        displayName: `Firefox (${dir.replace(/^[^.]*\./, '')})`,
        dbPath,
      })
    }
  }
  targets.sort((x, y) => x.profile.localeCompare(y.profile))
  return targets
}

// --- parse ---

interface PlacesRow {
  visitId: bigint
  visitDate: bigint
  visitType: bigint
  url: string
  title: string | null
}

// one firefox profile
export class FirefoxSource implements ProfileSource {
  readonly browser: string
  readonly profile: string
  readonly kind = 'firefox' as const
  readonly idMode: IdMode = 'rowid'
  readonly label: string
  readonly profilePath: string

  readonly #target: SnapshotTarget
  readonly #home: string

  constructor(target: SnapshotTarget, home: string) {
    this.#target = target
    this.#home = home
    this.browser = target.browser
    this.profile = target.profile
    this.label = `${this.kind} · ${target.displayName ?? target.profile}`
    this.profilePath = target.dbPath
  }

  snapshot(): SnapshotResult {
    return snapshot(this.#target, this.#home)
  }
  parse(path: string): NativeVisit[] {
    const db = new DatabaseSync(path, { readOnly: true })
    try {
      const statement = db.prepare(
        'SELECT h.id AS visitId, h.visit_date AS visitDate, h.visit_type AS visitType, p.url AS url, p.title AS title FROM moz_historyvisits h JOIN moz_places p ON p.id = h.place_id ORDER BY h.id',
      )
      statement.setReadBigInts(true)
      const rows = statement.all() as unknown as PlacesRow[]
      return rows.map(toNativeVisit).filter((visit): visit is NativeVisit => visit !== null)
    } finally {
      db.close()
    }
  }
}

// places visit_type to TransitionType; 5/6/7 have no enum value and fall back to link
const PLACES_TO_TRANSITION = new Map<number, Transition>([
  [1, 'link'],
  [2, 'typed'],
  [3, 'auto_bookmark'],
  [4, 'auto_subframe'],
  [8, 'manual_subframe'],
  [9, 'reload'],
])

function toNativeVisit(row: PlacesRow): NativeVisit | null {
  // unset visit_date (0 = epoch) would pollute first/last_visit_time
  if (row.visitDate === 0n) return null
  const mapped = PLACES_TO_TRANSITION.get(Number(row.visitType))
  return {
    sourceVisitId: Number(row.visitId),
    url: row.url,
    title: row.title || null,
    visitTime: prTimeToMs(row.visitDate),
    transition: mapped ?? 'link',
  }
}

// --- helpers ---

export function prTimeToMs(prTimeUs: bigint | number): EpochMs {
  const us = typeof prTimeUs === 'bigint' ? prTimeUs : BigInt(Math.round(prTimeUs))
  return Number((us + 500n) / 1000n)
}

function firefoxDataRoot(platform: NodeJS.Platform): string | null {
  const home = os.homedir()
  if (platform === 'darwin') return `${home}/Library/Application Support/Firefox`
  if (platform === 'linux') return `${home}/.mozilla/firefox`
  if (platform === 'win32') return `${process.env.APPDATA ?? `${home}/AppData/Roaming`}/Mozilla/Firefox`
  return null
}

function slugifyDir(dir: string): string {
  return dir.replace(/[^A-Za-z0-9._-]+/g, '-')
}
