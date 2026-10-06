import { createSource, open } from '@his/core'
import { historyDbPath } from '../home.ts'
import type { SyncHooks, SyncOptions, SyncSummary } from './types.ts'
import { discoverAllTargets } from './discover.ts'
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
    const targets = discoverAllTargets(home, options)
    if (targets.length === 0)
      hooks.onLog?.('no targets found')

    for (const target of targets) {
      const source = createSource(target, home)
      const result = runTarget({ db, source, options, hooks })
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
    return summary
  } finally {
    db.close()
  }
}
