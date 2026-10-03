import fs from 'node:fs'
import path from 'node:path'
import {
  discoverChromiumProfiles,
  discoverFirefoxProfiles,
  discoverSafariProfiles,
  open,
  parseChromiumStaging,
  parseFirefoxStaging,
  parseSafariStaging,
  parseTakeoutStaging,
  run,
  snapshot,
  takeoutProfileKey,
  type RunResult,
  type SnapshotTarget,
  type SourceKind,
} from '@his/core'
import { historyDbPath, takeoutDir } from './home.ts'

const SYNC_KINDS: SourceKind[] = ['chromium', 'firefox', 'safari', 'takeout']

export interface SyncOptions {
  source?: string
  full?: boolean
}

export function sync(home: string, opts: SyncOptions): void {
  const source = opts.source?.toLowerCase()
  if (source !== undefined && !SYNC_KINDS.includes(source as SourceKind)) {
    throw new Error(`unknown source: ${source} (kinds: ${SYNC_KINDS.join(' ')})`)
  }
  const db = open(historyDbPath(home))
  const kinds: SourceKind[] = source === undefined ? SYNC_KINDS : [source as SourceKind]
  let attempted = 0
  let failures = 0
  for (const kind of kinds) {
    for (const target of discoverTargets(kind, home)) {
      attempted += 1
      try {
        const snap = snapshot(target, home)
        const visits = parseForKind(kind, snap.path)
        const result: RunResult = run({
          db,
          profile: {
            kind: target.source as SourceKind,
            displayName: target.displayName ?? null,
            profilePath: target.dbPath,
          },
          visits,
          options: { full: opts.full ?? false, now: Date.now() },
        })
        console.log(`${kindLabel(target)}: +${result.insertedVisits} visits · ${result.touchedUrls} urls${result.cleared ? ' (history cleared, offset realigned)' : ''}`)
      } catch (error) {
        failures += 1
        console.error(`${kindLabel(target)}: ${error instanceof Error ? error.message : String(error)}`)
      }
    }
  }
  db.close()
  if (failures > 0) throw new Error(`sync failed for ${failures} of ${attempted} targets`)
}

function discoverTargets(kind: SourceKind, home: string): SnapshotTarget[] {
  switch (kind) {
    case 'chromium':
      return discoverChromiumProfiles()
    case 'firefox':
      return discoverFirefoxProfiles()
    case 'safari':
      return discoverSafariProfiles()
    case 'takeout':
      return takeoutTargets(home)
  }
}

function takeoutTargets(home: string): SnapshotTarget[] {
  const dir = takeoutDir(home)
  if (!fs.existsSync(dir)) return []
  return fs.readdirSync(dir)
    .filter((name) => name.endsWith('.json'))
    .sort()
    .map((name) => {
      const dbPath = path.join(dir, name)
      return {
        source: 'takeout' as const,
        profile: takeoutProfileKey(dbPath),
        displayName: `Takeout (${name})`,
        dbPath,
      }
    })
}

function parseForKind(kind: SourceKind, snapshotPath: string) {
  switch (kind) {
    case 'chromium':
      return parseChromiumStaging(snapshotPath)
    case 'firefox':
      return parseFirefoxStaging(snapshotPath)
    case 'safari':
      return parseSafariStaging(snapshotPath)
    case 'takeout':
      return parseTakeoutStaging(snapshotPath)
  }
}

function kindLabel(target: SnapshotTarget): string {
  return `${target.source} · ${target.displayName ?? target.profile}`
}