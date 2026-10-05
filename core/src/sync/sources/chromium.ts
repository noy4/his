import fs from 'node:fs'
import os from 'node:os'
import path from 'node:path'
import { DatabaseSync } from 'node:sqlite'
import type { EpochMs, Transition } from '../../model.ts'
import { listDirs } from './dirs.ts'
import type { NativeVisit } from '../applyVisits.ts'
import type { SnapshotTarget } from '../snapshot.ts'

// --- discovery ---

export interface ChromiumApp {
  slug: 'chrome' | 'chromium' | 'edge' | 'brave' | 'vivaldi' | 'arc' | 'opera' | 'opera-gx'
  displayName: string
  userDir: string
}

const CHROMIUM_APPS: Partial<Record<NodeJS.Platform, ChromiumApp[]>> = {
  darwin: [
    { slug: 'chrome', displayName: 'Google Chrome', userDir: 'Google/Chrome' },
    { slug: 'edge', displayName: 'Microsoft Edge', userDir: 'Microsoft Edge' },
    { slug: 'brave', displayName: 'Brave', userDir: 'BraveSoftware/Brave-Browser' },
    { slug: 'vivaldi', displayName: 'Vivaldi', userDir: 'Vivaldi' },
    { slug: 'arc', displayName: 'Arc', userDir: 'Arc' },
    { slug: 'opera', displayName: 'Opera', userDir: 'com.operasoftware.Opera' },
  ],
  win32: [
    { slug: 'chrome', displayName: 'Google Chrome', userDir: 'Google/Chrome' },
    { slug: 'edge', displayName: 'Microsoft Edge', userDir: 'Microsoft/Edge' },
    { slug: 'brave', displayName: 'Brave', userDir: 'BraveSoftware/Brave-Browser' },
    { slug: 'vivaldi', displayName: 'Vivaldi', userDir: 'Vivaldi' },
    { slug: 'opera', displayName: 'Opera', userDir: 'Opera Software/Opera Stable' },
    { slug: 'opera-gx', displayName: 'Opera GX', userDir: 'Opera Software/Opera GX Stable' },
  ],
  linux: [
    { slug: 'chrome', displayName: 'Google Chrome', userDir: 'google-chrome' },
    { slug: 'chromium', displayName: 'Chromium', userDir: 'chromium' },
    { slug: 'edge', displayName: 'Microsoft Edge', userDir: 'microsoft-edge' },
    { slug: 'brave', displayName: 'Brave', userDir: 'BraveSoftware/Brave-Browser' },
    { slug: 'vivaldi', displayName: 'Vivaldi', userDir: 'vivaldi' },
    { slug: 'arc', displayName: 'Arc', userDir: 'Arc' },
    { slug: 'opera', displayName: 'Opera', userDir: 'opera' },
  ],
}

export function discoverChromiumProfiles(platform: NodeJS.Platform = process.platform, dataRoot: string | null = platformDataRoot(platform)): SnapshotTarget[] {
  if (dataRoot === null) return []
  const targets: SnapshotTarget[] = []
  for (const app of CHROMIUM_APPS[platform] ?? []) {
    const root = path.join(dataRoot, app.userDir)
    if (!fs.existsSync(root)) continue
    for (const dir of listDirs(root)) {
      if (NOISE_PROFILE_DIRS.has(dir)) continue
      const dbPath = path.join(root, dir, 'History')
      if (!fs.existsSync(dbPath)) continue
      targets.push({
        source: 'chromium',
        profile: profileKey(app.slug, dir),
        displayName: `${app.displayName} (${dir})`,
        dbPath,
      })
    }
  }
  targets.sort((x, y) => x.profile.localeCompare(y.profile))
  return targets
}

// --- parse ---

const NOISE_PROFILE_DIRS = new Set(['System Profile', 'Guest Profile'])

interface ChromiumRow {
  visitId: bigint
  visitTime: bigint
  transition: bigint
  url: string
  title: string | null
}

export function parseChromiumStaging(stagingHistoryPath: string): NativeVisit[] {
  const db = new DatabaseSync(stagingHistoryPath, { readOnly: true })
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

function profileKey(slug: string, dir: string): string {
  return `${slug}-${dir.replace(/[^A-Za-z0-9._-]+/g, '-')}`
}
