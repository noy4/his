import type { SyncOptions, SyncSummary } from '../../types.ts'
import { initDb } from '../../db/db.ts'
import { historyDbPath } from '../../paths.ts'
import { resolveTargets } from '../sources/discover.ts'
import { runTarget } from './runTarget.ts'

export interface SyncHooks {
  onLog?(line: string): void
  onError?(line: string): void
}

export async function runSync(
  home: string,
  options: SyncOptions = {},
  hooks: SyncHooks = {},
): Promise<SyncSummary> {
  const db = await initDb(historyDbPath(home))
  try {
    const summary: SyncSummary = {
      attempted: 0,
      failures: 0,
      skipped: 0,
      insertedVisits: 0,
      touchedUrls: 0,
      errors: [],
    }
    const targets = resolveTargets(home, options.targets)
    if (targets.length === 0)
      hooks.onLog?.('no targets found')

    for (const target of targets) {
      const result = await runTarget({ db, home, target, options, hooks })
      summary.attempted += 1
      switch (result.status) {
        case 'failure':
          summary.failures += 1
          summary.errors.push(result.error)
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
    await db.destroy()
  }
}
