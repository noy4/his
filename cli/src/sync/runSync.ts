import { open } from '@his/core'
import type { SourceKind } from '@his/core'
import { historyDbPath } from '../home.ts'
import { SYNC_KINDS, isSourceKind, type SyncHooks, type SyncOptions, type SyncSummary } from './types.ts'
import { discoverTargets } from './discover.ts'
import { runTarget } from './runTarget.ts'

export function runSync(
  home: string,
  options: SyncOptions = {},
  hooks: SyncHooks = {},
): SyncSummary {
  if (options.source !== undefined && !isSourceKind(options.source)) {
    throw new Error(`unknown source: ${options.source} (kinds: ${SYNC_KINDS.join(' ')})`)
  }
  const db = open(historyDbPath(home))
  try {
    const kinds: SourceKind[] = options.source != null
      ? [options.source as SourceKind]
      : SYNC_KINDS
    const summary: SyncSummary = {
      attempted: 0,
      failures: 0,
      skipped: 0,
      insertedVisits: 0,
      touchedUrls: 0,
    }
    for (const kind of kinds) {
      for (const target of discoverTargets(kind, home)) {
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
    return summary
  } finally {
    db.close()
  }
}
