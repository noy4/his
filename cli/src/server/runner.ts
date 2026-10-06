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
  run(options: SyncOptions): Promise<SyncSummary>
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

  function run(runOptions: SyncOptions): Promise<SyncSummary> {
    // sync throw keeps the 'already running' guard visible to plain callers
    if (running) throw new Error('sync already running')
    running = true
    const startedAt = Date.now()
    const failureLines: string[] = []
    return doRun(runOptions, startedAt, failureLines).finally(() => {
      running = false
    })
  }

  async function doRun(runOptions: SyncOptions, startedAt: EpochMs, failureLines: string[]): Promise<SyncSummary> {
    try {
      const summary = await runSync(home, runOptions, {
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
    } catch (error) {
      // setup can reject (db open, migrations) — record it, then surface
      last = {
        startedAt,
        finishedAt: Date.now(),
        ok: false,
        error: error instanceof Error ? error.message : String(error),
        attempted: 0,
        failures: 0,
        insertedVisits: 0,
        touchedUrls: 0,
      }
      throw error
    }
  }

  return {
    run,
    isRunning: () => running,
    lastRun: () => last,
  }
}
