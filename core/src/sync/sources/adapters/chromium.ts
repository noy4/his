import fs from 'node:fs'
import os from 'node:os'
import path from 'node:path'
import { DatabaseSync } from 'node:sqlite'
import type { EpochMs, Transition } from '../../../model.ts'
import type { NativeVisit } from '../../applyVisits.ts'
import { listDirs, dirToProfileName } from '../dirs.ts'
import type { Browser, Engine, SyncTarget } from '../types.ts'

export const chromiumEngine: Engine = {
  kind: 'chromium',
  idMode: 'rowid',
  discover: (browser, _home, profile) => resolveChromium(browser, profile),
  parse: parseChromium,
}

export const CHROMIUM_BROWSERS: readonly Browser[] = [
  { name: 'chrome', label: 'Google Chrome', engine: chromiumEngine, userDirs: { darwin: 'Google/Chrome', win32: 'Google/Chrome', linux: 'google-chrome' } },
  { name: 'chromium', label: 'Chromium', engine: chromiumEngine, userDirs: { linux: 'chromium' } },
  { name: 'edge', label: 'Microsoft Edge', engine: chromiumEngine, userDirs: { darwin: 'Microsoft Edge', win32: 'Microsoft/Edge', linux: 'microsoft-edge' } },
  { name: 'brave', label: 'Brave', engine: chromiumEngine, userDirs: { darwin: 'BraveSoftware/Brave-Browser', win32: 'BraveSoftware/Brave-Browser', linux: 'BraveSoftware/Brave-Browser' } },
  { name: 'vivaldi', label: 'Vivaldi', engine: chromiumEngine, userDirs: { darwin: 'Vivaldi', win32: 'Vivaldi', linux: 'vivaldi' } },
  { name: 'arc', label: 'Arc', engine: chromiumEngine, userDirs: { darwin: 'Arc', linux: 'Arc' } },
  { name: 'opera', label: 'Opera', engine: chromiumEngine, userDirs: { darwin: 'com.operasoftware.Opera', win32: 'Opera Software/Opera Stable', linux: 'opera' } },
  { name: 'opera-gx', label: 'Opera GX', engine: chromiumEngine, userDirs: { win32: 'Opera Software/Opera GX Stable' } },
]

// --- discovery ---

// one chromium browser's profiles; profile token selects one (slug match),
// undefined = every profile whose History path exists under the app root
export function resolveChromium(browser: Browser, profile: string | undefined, platform: NodeJS.Platform = process.platform, dataRoot: string | null = platformDataRoot(platform)): SyncTarget[] {
  if (dataRoot === null) return []
  const userDir = browser.userDirs?.[platform]
  if (userDir === undefined) return []
  const root = path.join(dataRoot, userDir)
  if (!fs.existsSync(root)) return []
  return listDirs(root)
    .filter((dir) => !NOISE_PROFILE_DIRS.has(dir))
    .filter((dir) => fs.existsSync(path.join(root, dir, 'History')))
    .filter((dir) => profile === undefined || dirToProfileName(dir) === profile)
    .map((dir) => ({
      browser: browser.name,
      profile: dirToProfileName(dir),
      dbPath: path.join(root, dir, 'History'),
    }))
    .sort((x, y) => x.profile.localeCompare(y.profile))
}

const NOISE_PROFILE_DIRS = new Set(['System Profile', 'Guest Profile'])

// --- parse ---

interface ChromiumRow {
  visitId: bigint
  visitTime: bigint
  transition: bigint
  url: string
  title: string | null
}

function parseChromium(path: string): NativeVisit[] {
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
