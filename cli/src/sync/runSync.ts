import { open } from '@his/core'
import { historyDbPath } from '../home.ts'
import { SYNC_KINDS, type SyncHooks, type SyncOptions, type SyncSummary } from './types.ts'
import { discoverTargets } from './discover.ts'
import { runTarget } from './runTarget.ts'

export function runSync(
  home: string,
  options: SyncOptions = {},
  hooks: SyncHooks = {},
): SyncSummary {
  const db = open(historyDbPath(home))
  try {
    const summary: SyncSummary = {
      attempted: 0,
      failures: 0,
      skipped: 0,
      insertedVisits: 0,
      touchedUrls: 0,
    }
    for (const kind of SYNC_KINDS) {
      for (const target of discoverTargets(kind, home, options)) {
        const result = runTarget({ db, home, target, options, hooks })
        summary.attempted += 1
        switch (result.status) {
          case 'failure':
            summary.failures += 1
            break
          case 'skipped':
            summary.skipped += 1
            break
          case 'success':
            summary.insertedVisits += result.insertedVisits
            summary.touchedUrls += result.touchedUrls
            break
        }
      }
    }
    if (summary.attempted === 0)
      hooks.onLog?.('no targets found')
    return summary
  } finally {
    db.close()
  }
}
