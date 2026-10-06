import type { SyncOptions, SyncSummary } from '../model.ts'
import type { SnapshotTarget } from './snapshot.ts'
import { initDb } from '../db/db.ts'
import { historyDbPath } from '../paths.ts'
import { discoverAllTargets } from './discover.ts'
import { runTarget } from './runTarget.ts'
import { createSource } from './sources/source.ts'

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
    }
    const targets = filterTargets(discoverAllTargets(home), options.targets)
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

// normalize user input the way discovery slugified its dirs
const DIR_PATTERN = /[^A-Za-z0-9._-]+/g

// targets limit: "browser:profile" exact, bare "browser" = all its profiles
function filterTargets(targets: SnapshotTarget[], wanted: string[] | undefined): SnapshotTarget[] {
  if (wanted === undefined) return targets
  const normalized = wanted.map((t) => {
    const at = t.indexOf(':')
    return at === -1 ? t : `${t.slice(0, at)}:${t.slice(at + 1).replace(DIR_PATTERN, '-')}`
  })
  return targets.filter((target) => {
    const key = `${target.browser}:${target.profile}`
    return normalized.some((t) => key === t || (!t.includes(':') && key.startsWith(`${t}:`)))
  })
}
