import type { DatabaseSync } from 'node:sqlite'
import type { SyncOptions } from '../model.ts'
import type { ApplyVisitsResult } from './applyVisits.ts'
import { applyVisits } from './applyVisits.ts'
import type { ProfileSource } from './sources/source.ts'
import type { SyncHooks } from './runSync.ts'
import { probeFingerprint } from './fingerprint.ts'
import { getTargetFingerprint, setTargetFingerprint } from './watermarks.ts'

interface RunTargetParams {
  db: DatabaseSync
  source: ProfileSource
  options: SyncOptions
  hooks: SyncHooks
}

type RunTargetResult =
  | { status: 'success'; insertedVisits: number; touchedUrls: number }
  | { status: 'skipped' }
  | { status: 'failure' }

export function runTarget(params: RunTargetParams): RunTargetResult {
  const { db, source, options, hooks } = params
  const label = source.label

  try {
    // check fingerprint (--full bypasses)
    const fingerprint = probeFingerprint(source.profilePath)

    if (!options.full) {
      const stored = getTargetFingerprint(db, source.browser, source.profile)
      if (stored === fingerprint) {
        hooks.onLog?.(`${label}: unchanged — skipped`)
        return { status: 'skipped' }
      }
    }

    // snapshot and parse
    const snap = source.snapshot()
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
