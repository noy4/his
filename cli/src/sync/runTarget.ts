import type { DatabaseSync } from 'node:sqlite'
import {
  applyVisits,
  getTargetFingerprint,
  ID_MODES,
  parseChromiumStaging,
  parseFirefoxStaging,
  parseSafariStaging,
  parseTakeoutStaging,
  setTargetFingerprint,
  snapshot,
} from '@his/core'
import type { ApplyVisitsResult, SnapshotTarget, SourceKind } from '@his/core'
import type { SyncHooks, SyncOptions } from './types.ts'
import { probeFingerprint } from './fingerprint.ts'

interface RunTargetParams {
  db: DatabaseSync
  home: string
  target: SnapshotTarget
  options: SyncOptions
  hooks: SyncHooks
}

// status per target
type RunTargetResult =
  | { status: 'success'; insertedVisits: number; touchedUrls: number }
  | { status: 'skipped' }
  | { status: 'failure' }

// One target's pipeline: gate → snapshot → parse → upsert. Never throws.
export function runTarget(params: RunTargetParams): RunTargetResult {
  const { db, home, target, options, hooks } = params
  const label = kindLabel(target)

  try {
    // check fingerprint (--full bypasses)
    const fingerprint = probeFingerprint(target.dbPath)

    if (options.full !== true) {
      const stored = getTargetFingerprint(db, target.source as SourceKind, target.dbPath)
      if (stored === fingerprint) {
        hooks.onLog?.(`${label}: unchanged — skipped`)
        return { status: 'skipped' }
      }
    }

    // snapshot and parse
    const snap = snapshot(target, home)
    const visits = parseForKind(target.source as SourceKind, snap.path)

    // upsert visits
    const profile = {
      kind: target.source as SourceKind,
      displayName: target.displayName ?? null,
      profilePath: target.dbPath,
      idMode: ID_MODES[target.source as SourceKind],
    }
    const result: ApplyVisitsResult = applyVisits({
      db,
      profile,
      visits,
      options: {
        full: options.full ?? false,
        now: Date.now(),
      },
    })

    // save fingerprint
    setTargetFingerprint(db, result.sourceProfileId, fingerprint)

    hooks.onLog?.(`${label}: +${result.insertedVisits} visits · ${result.touchedUrls} urls${result.cleared ? ' (history cleared, offset realigned)' : ''}`)

    return {
      status: 'success',
      insertedVisits: result.insertedVisits,
      touchedUrls: result.touchedUrls,
    }
  } catch (error) {
    // one error line, then the loop carries on with the next target
    hooks.onError?.(`${label}: ${error instanceof Error ? error.message : String(error)}`)

    return { status: 'failure' }
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
