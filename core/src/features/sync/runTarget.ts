import type { KyselyDb } from '../../db/db.ts'
import type { SyncOptions } from '../../types.ts'
import type { ApplyVisitsResult } from './applyVisits.ts'
import { applyVisits } from './applyVisits.ts'
import { snapshot } from './snapshot.ts'
import type { SyncTarget } from '../sources/types.ts'
import { browserOf } from '../sources/browsers.ts'
import type { SyncHooks } from './runSync.ts'
import { probeSourceFingerprint } from '../sources/fingerprint.ts'
import { getStoredFingerprint, storeFingerprint } from './checkpoints.ts'

interface RunTargetParams {
  db: KyselyDb
  home: string
  target: SyncTarget
  options: SyncOptions
  hooks: SyncHooks
}

type RunTargetResult =
  | { status: 'success'; insertedVisits: number; touchedUrls: number }
  | { status: 'skipped' }
  | { status: 'failure'; error: string }

export async function runTarget(params: RunTargetParams): Promise<RunTargetResult> {
  const { db, home, target, options, hooks } = params
  const browser = browserOf(target.browser)
  const { engine } = browser
  const logLabel = `${browser.label} · ${target.profile}`

  try {
    // check fingerprint (--rescan bypasses)
    const fingerprint = probeSourceFingerprint(target.dbPath)

    if (!options.rescan) {
      const stored = await getStoredFingerprint(db, target.browser, target.profile)
      if (stored === fingerprint) {
        hooks.onLog?.(`${logLabel}: unchanged — skipped`)
        return { status: 'skipped' }
      }
    }

    // snapshot and parse
    const snap = snapshot(target, home)
    const visits = engine.parse(snap.path)

    // upsert visits
    const result: ApplyVisitsResult = await applyVisits({
      db,
      profile: {
        browser: target.browser,
        profile: target.profile,
        kind: engine.kind,
        idMode: engine.idMode,
        profilePath: target.dbPath,
      },
      visits,
      options: {
        rescan: options.rescan,
        now: Date.now(),
      },
    })

    // save fingerprint
    await storeFingerprint(db, result.sourceProfileId, fingerprint)

    hooks.onLog?.(`${logLabel}: +${result.insertedVisits} visits · ${result.touchedUrls} urls${result.cleared ? ' (history cleared, offset realigned)' : ''}`)

    return {
      status: 'success',
      insertedVisits: result.insertedVisits,
      touchedUrls: result.touchedUrls,
    }
  } catch (error) {
    // one error line, then the loop carries on with the next target
    const line = `${logLabel}: ${error instanceof Error ? error.message : String(error)}`
    hooks.onError?.(line)

    return { status: 'failure', error: line }
  }
}
