import fs from 'node:fs'
import os from 'node:os'
import path from 'node:path'
import { DatabaseSync } from 'node:sqlite'
import type { EpochMs, Transition } from '../../model.js'
import type { NativeVisit } from '../run.js'
import type { SnapshotTarget } from '../snapshot.js'

// --- discovery ---

export interface ChromiumApp {
  slug: 'chrome' | 'edge' | 'brave' | 'vivaldi' | 'arc'
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
  ],
  win32: [
    { slug: 'chrome', displayName: 'Google Chrome', userDir: 'Google/Chrome' },
    { slug: 'edge', displayName: 'Microsoft Edge', userDir: 'Microsoft/Edge' },
    { slug: 'brave', displayName: 'Brave', userDir: 'BraveSoftware/Brave-Browser' },
    { slug: 'vivaldi', displayName: 'Vivaldi', userDir: 'Vivaldi' },
  ],
  linux: [
    { slug: 'chrome', displayName: 'Google Chrome', userDir: 'google-chrome' },
    { slug: 'edge', displayName: 'Microsoft Edge', userDir: 'microsoft-edge' },
    { slug: 'brave', displayName: 'Brave', userDir: 'BraveSoftware/Brave-Browser' },
    { slug: 'vivaldi', displayName: 'Vivaldi', userDir: 'vivaldi' },
    { slug: 'arc', displayName: 'Arc', userDir: 'Arc' },
  ],
}

export function discoverChromiumProfiles(platform: NodeJS.Platform = process.platform, dataRoot: string | null = platformDataRoot(platform)): SnapshotTarget[] {
  if (dataRoot === null) return []
  const targets: SnapshotTarget[] = []
  for (const app of CHROMIUM_APPS[platform] ?? []) {
    const root = path.join(dataRoot, app.userDir)
    if (!fs.existsSync(root)) continue
    for (const dir of fs.readdirSync(root, { withFileTypes: true })) {
      if (!dir.isDirectory()) continue
      if (NOISE_PROFILE_DIRS.has(dir.name)) continue
      const dbPath = path.join(root, dir.name, 'History')
      if (!fs.existsSync(dbPath)) continue
      targets.push({
        source: 'chromium',
        profile: profileKey(app.slug, dir.name),
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
    return rows.map(toNativeVisit)
  } finally {
    db.close()
  }
}

const CORE_MASK = 0xff

const CORE_TO_TRANSITION = new Map<number, Transition>([
  [0, 'LINK'],
  [1, 'TYPED'],
  [2, 'AUTO_BOOKMARK'],
  [3, 'AUTO_SUBFRAME'],
  [4, 'MANUAL_SUBFRAME'],
  [5, 'GENERATED'],
  [6, 'START_PAGE'],
  [7, 'FORM_SUBMIT'],
  [8, 'RELOAD'],
])

function toNativeVisit(row: ChromiumRow): NativeVisit {
  const core = Number(row.transition) & CORE_MASK
  const mapped = CORE_TO_TRANSITION.get(core)
  const hasQualifiers = row.transition !== BigInt(core)
  return {
    sourceVisitId: Number(row.visitId),
    url: row.url,
    title: row.title ?? null,
    visitTime: webkitTimeToMs(row.visitTime),
    transition: mapped ?? 'LINK',
    sourceTransition: mapped === undefined || hasQualifiers ? String(row.transition) : null,
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
