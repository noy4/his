import type { DatabaseSync } from 'node:sqlite'
import {
  applyVisits,
  createSource,
  getTargetFingerprint,
  setTargetFingerprint,
} from '@his/core'
import type { ApplyVisitsResult, SnapshotTarget } from '@his/core'
import type { SyncHooks, SyncOptions } from './types.ts'
import { probeFingerprint } from './fingerprint.ts'

interface RunTargetParams {
  db: DatabaseSync
  home: string
  target: SnapshotTarget
  options: SyncOptions
  hooks: SyncHooks
}

type RunTargetResult =
  | { status: 'success'; insertedVisits: number; touchedUrls: number }
  | { status: 'skipped' }
  | { status: 'failure' }

export function runTarget(params: RunTargetParams): RunTargetResult {
  const { db, home, target, options, hooks } = params
  const label = kindLabel(target)

  try {
    const source = createSource(target)

    // check fingerprint (--full bypasses)
    const fingerprint = probeFingerprint(source.profilePath)

    if (!options.full) {
      const stored = getTargetFingerprint(db, source.kind, source.profilePath)
      if (stored === fingerprint) {
        hooks.onLog?.(`${label}: unchanged — skipped`)
        return { status: 'skipped' }
      }
    }

    // snapshot and parse
    const snap = source.snapshot(home)
    const visits = source.parse(snap.path)

    // upsert visits
    const result: ApplyVisitsResult = applyVisits({
      db,
      profile: source,
      visits,
      options: {
        full: options.full,
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

// log label, e.g. "chromium · Brave (Default)"
function kindLabel(target: SnapshotTarget): string {
  return `${target.source} · ${target.displayName ?? target.profile}`
}
