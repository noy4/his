import type { DatabaseSync } from 'node:sqlite'
import {
  getTargetFingerprint,
  parseChromiumStaging,
  parseFirefoxStaging,
  parseSafariStaging,
  parseTakeoutStaging,
  run,
  setTargetFingerprint,
  snapshot,
} from '@his/core'
import type { RunResult, SnapshotTarget, SourceKind } from '@his/core'
import type { SyncHooks, SyncOptions } from './types.ts'
import { probeFingerprint } from './fingerprint.ts'

interface RunTargetParams {
  db: DatabaseSync
  home: string
  target: SnapshotTarget
  options: SyncOptions
  hooks: SyncHooks
}

// failureLine = this target's label on failure; null = ok
interface TargetOutcome {
  failureLine: string | null
  skipped: boolean
  insertedVisits: number
  touchedUrls: number
}

// One target's pipeline: gate → snapshot → parse → upsert. Never throws.
export function runTarget(params: RunTargetParams): TargetOutcome {
  const { db, home, target, options, hooks } = params
  const label = kindLabel(target)

  try {
    // unchanged gate (--full bypasses)
    const fingerprint = probeFingerprint(target.dbPath)
    if (options.full !== true) {
      const stored = getTargetFingerprint(db, target.source as SourceKind, target.dbPath)
      if (stored === fingerprint) {
        hooks.onLog?.(`${label}: unchanged — skipped`)
        return { failureLine: null, skipped: true, insertedVisits: 0, touchedUrls: 0 }
      }
    }

    // snapshot into staging, then parse the copy — never the live file
    const snap = snapshot(target, home)
    const visits = parseForKind(target.source as SourceKind, snap.path)

    // upsert visits (watermark dedup, cleared-history realign)
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

    // fingerprint saved after commit — a failed run retries next time
    setTargetFingerprint(db, result.sourceProfileId, fingerprint)

    hooks.onLog?.(`${label}: +${result.insertedVisits} visits · ${result.touchedUrls} urls${result.cleared ? ' (history cleared, offset realigned)' : ''}`)

    return { failureLine: null, skipped: false, insertedVisits: result.insertedVisits, touchedUrls: result.touchedUrls }
  } catch (error) {
    // one error line, then the loop carries on with the next target
    hooks.onError?.(`${label}: ${error instanceof Error ? error.message : String(error)}`)
    return { failureLine: label, skipped: false, insertedVisits: 0, touchedUrls: 0 }
  }
}

// staging file → visits, by source kind
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

// log label, e.g. "chromium · Brave (Default)"
function kindLabel(target: SnapshotTarget): string {
  return `${target.source} · ${target.displayName ?? target.profile}`
}
