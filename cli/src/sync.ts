import fs from 'node:fs'
import path from 'node:path'
import type { DatabaseSync } from 'node:sqlite'
import {
  discoverChromiumProfiles,
  discoverFirefoxProfiles,
  discoverSafariProfiles,
  getTargetFingerprint,
  open,
  parseChromiumStaging,
  parseFirefoxStaging,
  parseSafariStaging,
  parseTakeoutStaging,
  run,
  setTargetFingerprint,
  snapshot,
  takeoutProfileKey,
  type RunResult,
  type SnapshotTarget,
  type SourceKind,
} from '@his/core'
import type { Context } from './context.ts'
import { historyDbPath, takeoutDir } from './home.ts'

// --- contract ---

export const SYNC_KINDS: SourceKind[] = ['chromium', 'firefox', 'safari', 'takeout']

export function isSourceKind(value: string): value is SourceKind {
  return SYNC_KINDS.includes(value as SourceKind)
}

export interface SyncOptions {
  source?: string
  full?: boolean
}

export interface SyncProgressEvent {
  source: string
  phase: 'snapshot' | 'upsert' | 'done'
  parsed: number | null
  upserted: number | null
}

export interface SyncHooks {
  onProgress?(event: SyncProgressEvent): void
  onLog?(line: string): void
  onError?(line: string): void
}

export interface SyncSummary {
  attempted: number
  failures: number
  skipped: number
  insertedVisits: number
  touchedUrls: number
}

// snapshot → parse → upsert per discovered target. Runs against one writer
// connection; when the caller owns one (the serve process) it is reused,
// otherwise this opens and closes its own.
export function runSync(home: string, options: SyncOptions = {}, hooks: SyncHooks = {}, externalDb?: DatabaseSync): SyncSummary {
  if (options.source !== undefined && !isSourceKind(options.source)) {
    throw new Error(`unknown source: ${options.source} (kinds: ${SYNC_KINDS.join(' ')})`)
  }
  const owned = externalDb === undefined
  const db = externalDb ?? open(historyDbPath(home))
  try {
    const kinds: SourceKind[] = options.source === undefined ? SYNC_KINDS : [options.source as SourceKind]
    const summary: SyncSummary = { attempted: 0, failures: 0, skipped: 0, insertedVisits: 0, touchedUrls: 0 }
    for (const kind of kinds) {
      for (const target of discoverTargets(kind, home)) {
        const outcome = runTarget({ db, home, target, options, hooks })
        summary.attempted += 1
        if (outcome.failureLine !== null) summary.failures += 1
        if (outcome.skipped) summary.skipped += 1
        summary.insertedVisits += outcome.insertedVisits
        summary.touchedUrls += outcome.touchedUrls
      }
    }
    return summary
  } finally {
    if (owned) db.close()
  }
}

// CLI entry — runs once and reports; failures make it exit 1 via the throw.
export function sync(ctx: Context, opts: SyncOptions): void {
  const summary = runSync(ctx.home, opts, {
    onLog: (line) => console.log(line),
    onError: (line) => console.error(line),
  })
  if (summary.failures > 0) {
    throw new Error(`sync failed for ${summary.failures} of ${summary.attempted} targets`)
  }
}

// --- one target ---

interface RunTargetParams {
  db: DatabaseSync
  home: string
  target: SnapshotTarget
  options: SyncOptions
  hooks: SyncHooks
}

interface TargetOutcome {
  failureLine: string | null
  skipped: boolean
  insertedVisits: number
  touchedUrls: number
}

function runTarget(params: RunTargetParams): TargetOutcome {
  const { db, home, target, options, hooks } = params
  const label = kindLabel(target)
  try {
    const fingerprint = probeFingerprint(target.dbPath)
    if (options.full !== true) {
      const stored = getTargetFingerprint(db, target.source as SourceKind, target.dbPath)
      if (stored === fingerprint) {
        hooks.onLog?.(`${label}: unchanged — skipped`)
        return { failureLine: null, skipped: true, insertedVisits: 0, touchedUrls: 0 }
      }
    }
    hooks.onProgress?.({ source: label, phase: 'snapshot', parsed: null, upserted: null })
    const snap = snapshot(target, home)
    const visits = parseForKind(target.source as SourceKind, snap.path)
    hooks.onProgress?.({ source: label, phase: 'upsert', parsed: visits.length, upserted: null })
    const result: RunResult = run({
      db,
      profile: {
        kind: target.source as SourceKind,
        displayName: target.displayName ?? null,
        profilePath: target.dbPath,
      },
      visits,
      options: { full: options.full ?? false, now: Date.now() },
    })
    // after the run's commit — a failed run leaves the fingerprint behind
    setTargetFingerprint(db, result.sourceProfileId, fingerprint)
    hooks.onProgress?.({ source: label, phase: 'done', parsed: visits.length, upserted: result.insertedVisits })
    hooks.onLog?.(`${label}: +${result.insertedVisits} visits · ${result.touchedUrls} urls${result.cleared ? ' (history cleared, offset realigned)' : ''}`)
    return { failureLine: null, skipped: false, insertedVisits: result.insertedVisits, touchedUrls: result.touchedUrls }
  } catch (error) {
    hooks.onError?.(`${label}: ${error instanceof Error ? error.message : String(error)}`)
    return { failureLine: label, skipped: false, insertedVisits: 0, touchedUrls: 0 }
  }
}

const SQLITE_SIDECARS = ['-wal', '-shm', '-journal']

// mtime/size probe of the target's source files (main + sidecars, or the
// takeout json) serialized for cross-run comparison.
function probeFingerprint(dbPath: string): string {
  const files = dbPath.endsWith('.json')
    ? [dbPath]
    : [dbPath, ...SQLITE_SIDECARS.map((ext) => dbPath + ext)]
  return JSON.stringify(files.map(statEntry))
}

function statEntry(file: string): [number, number] {
  try {
    const stats = fs.statSync(file, { throwIfNoEntry: false })
    return stats === undefined ? [0, -1] : [stats.mtimeMs, stats.size]
  } catch {
    return [0, -1]
  }
}

// --- discovery ---

export function discoverTargets(kind: SourceKind, home: string): SnapshotTarget[] {
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
