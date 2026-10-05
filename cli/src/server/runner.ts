import type { EpochMs } from '@his/core'
import type { SyncOptions, SyncSummary } from '../sync/types.ts'
import { runSync } from '../sync/runSync.ts'

// --- contract ---

// Owns the in-process sync execution state: single-flight guard, last-run
// record, and fan-out of db.changed over the broadcast channel. The watch
// loop (Task 4) drives this from outside the RPC layer.
export interface RunnerOptions {
  home: string
  broadcast(method: string, params: unknown): void
}

export interface SyncRunner {
  run(options: SyncOptions): SyncSummary
  isRunning(): boolean
  lastRun(): SyncLastRun | null
}

export interface SyncLastRun {
  startedAt: EpochMs
  finishedAt: EpochMs
  ok: boolean
  error: string | null
  attempted: number
  failures: number
  insertedVisits: number
  touchedUrls: number
}

// --- runner ---

export function createSyncRunner(options: RunnerOptions): SyncRunner {
  const { home } = options
  let running = false
  let last: SyncLastRun | null = null

  function run(runOptions: SyncOptions): SyncSummary {
    if (running) throw new Error('sync already running')
    running = true
    const startedAt = Date.now()
    const failureLines: string[] = []
    try {
      const summary = runSync(home, runOptions, {
        onError: (line) => failureLines.push(line),
      })
      if (summary.insertedVisits > 0) options.broadcast('db.changed', {})
      last = {
        startedAt,
        finishedAt: Date.now(),
        ok: summary.failures === 0,
        error: failureLines.length === 0 ? null : failureLines.join(' | '),
        attempted: summary.attempted,
        failures: summary.failures,
        insertedVisits: summary.insertedVisits,
        touchedUrls: summary.touchedUrls,
      }
      return summary
    } finally {
      running = false
    }
  }

  return {
    run,
    isRunning: () => running,
    lastRun: () => last,
  }
}
