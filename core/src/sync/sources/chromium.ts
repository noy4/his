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

export interface ChromiumApp {
  slug: 'chrome' | 'chromium' | 'edge' | 'brave' | 'vivaldi' | 'arc' | 'opera' | 'opera-gx'
  displayName: string
  /** user dir under the platform's data root; no key = app not on that platform */
  userDirs: Partial<Record<NodeJS.Platform, string>>
}

export const CHROMIUM_APPS: ChromiumApp[] = [
  { slug: 'chrome', displayName: 'Google Chrome', userDirs: { darwin: 'Google/Chrome', win32: 'Google/Chrome', linux: 'google-chrome' } },
  { slug: 'chromium', displayName: 'Chromium', userDirs: { linux: 'chromium' } },
  { slug: 'edge', displayName: 'Microsoft Edge', userDirs: { darwin: 'Microsoft Edge', win32: 'Microsoft/Edge', linux: 'microsoft-edge' } },
  { slug: 'brave', displayName: 'Brave', userDirs: { darwin: 'BraveSoftware/Brave-Browser', win32: 'BraveSoftware/Brave-Browser', linux: 'BraveSoftware/Brave-Browser' } },
  { slug: 'vivaldi', displayName: 'Vivaldi', userDirs: { darwin: 'Vivaldi', win32: 'Vivaldi', linux: 'vivaldi' } },
  { slug: 'arc', displayName: 'Arc', userDirs: { darwin: 'Arc', linux: 'Arc' } },
  { slug: 'opera', displayName: 'Opera', userDirs: { darwin: 'com.operasoftware.Opera', win32: 'Opera Software/Opera Stable', linux: 'opera' } },
  { slug: 'opera-gx', displayName: 'Opera GX', userDirs: { win32: 'Opera Software/Opera GX Stable' } },
]

// one chromium app's profiles; profile token selects one (slug match),
// undefined = every profile whose History path exists under the app root
export function resolveChromium(browser: string, profile: string | undefined, platform: NodeJS.Platform = process.platform, dataRoot: string | null = platformDataRoot(platform)): SnapshotTarget[] {
  if (dataRoot === null) return []
  const app = CHROMIUM_APPS.find((entry) => entry.slug === browser)
  if (app === undefined) return []
  const userDir = app.userDirs[platform]
  if (userDir === undefined) return []
  const root = path.join(dataRoot, userDir)
  if (!fs.existsSync(root)) return []
  return listDirs(root)
    .filter((dir) => !NOISE_PROFILE_DIRS.has(dir))
    .filter((dir) => fs.existsSync(path.join(root, dir, 'History')))
    .filter((dir) => profile === undefined || slugifyDir(dir) === profile)
    .map((dir) => ({
      browser: app.slug,
      profile: slugifyDir(dir),
      displayName: `${app.displayName} (${dir})`,
      dbPath: path.join(root, dir, 'History'),
    }))
    .sort((x, y) => x.profile.localeCompare(y.profile))
}

const NOISE_PROFILE_DIRS = new Set(['System Profile', 'Guest Profile'])

interface ChromiumRow {
  visitId: bigint
  visitTime: bigint
  transition: bigint
  url: string
  title: string | null
}

// one chromium profile
export class ChromiumSource implements ProfileSource {
  readonly browser: string
  readonly profile: string
  readonly kind = 'chromium' as const
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
        'SELECT v.id AS visitId, v.visit_time AS visitTime, v.transition AS transition, u.url AS url, u.title AS title FROM visits v JOIN urls u ON u.id = v.url ORDER BY v.id',
      )
      statement.setReadBigInts(true)
      const rows = statement.all() as unknown as ChromiumRow[]
      return rows.map(toNativeVisit).filter((visit): visit is NativeVisit => visit !== null)
    } finally {
      db.close()
    }
  }
}

const CORE_MASK = 0xff

const CORE_TO_TRANSITION = new Map<number, Transition>([
  [0, 'link'],
  [1, 'typed'],
  [2, 'auto_bookmark'],
  [3, 'auto_subframe'],
  [4, 'manual_subframe'],
  [5, 'generated'],
  [6, 'auto_toplevel'],
  [7, 'form_submit'],
  [8, 'reload'],
  [9, 'keyword'],
  [10, 'keyword_generated'],
])

function toNativeVisit(row: ChromiumRow): NativeVisit | null {
  const visitTime = webkitTimeToMs(row.visitTime)
  // unset timestamps (0 or pre-Webkit garbage) would pollute first/last_visit_time
  if (visitTime <= 0) return null
  const core = Number(row.transition) & CORE_MASK
  const mapped = CORE_TO_TRANSITION.get(core)
  return {
    sourceVisitId: Number(row.visitId),
    url: row.url,
    title: row.title || null,
    visitTime,
    transition: mapped ?? 'link',
  }
}

// --- helpers ---

const WEBKIT_US_OFFSET_MS = 11644473600000

export function webkitTimeToMs(webkitUs: bigint | number): EpochMs {
  const us = typeof webkitUs === 'bigint' ? webkitUs : BigInt(Math.round(webkitUs))
  return Number((us + 500n) / 1000n) - WEBKIT_US_OFFSET_MS
}

function platformDataRoot(platform: NodeJS.Platform): string | null {
  const home = os.homedir()
  if (platform === 'darwin') return `${home}/Library/Application Support`
  if (platform === 'linux') return `${home}/.config`
  if (platform === 'win32') return process.env.LOCALAPPDATA ?? `${home}/AppData/Local`
  return null
}

// filesystem dir to the slug used in profile keys
export function slugifyDir(dir: string): string {
  return dir.replace(/[^A-Za-z0-9._-]+/g, '-')
}
