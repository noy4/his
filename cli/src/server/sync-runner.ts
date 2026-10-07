import type { EpochMs, SyncLastRun, SyncOptions, SyncSummary } from '@his/core'
import { runSync } from '@his/core'

export interface SyncRunnerOptions {
  home: string
  broadcast(method: string, params: unknown): void
}

// In-process sync state: single-flight guard, last-run record, db.changed broadcast.
export class SyncRunner {
  private readonly home: string
  private readonly broadcast: (method: string, params: unknown) => void
  private running = false
  private last: SyncLastRun | null = null

  constructor(options: SyncRunnerOptions) {
    this.home = options.home
    this.broadcast = options.broadcast
  }

  async run(options: SyncOptions = {}): Promise<SyncSummary> {
    // sync throw keeps the 'already running' guard visible to plain callers
    if (this.running) throw new Error('sync already running')
    this.running = true
    const startedAt = Date.now()
    const failureLines: string[] = []
    return this.doRun(options, startedAt, failureLines).finally(() => {
      this.running = false
    })
  }

  // fire-and-forget pace helper for watch/index: skips when busy, failures
  // land on lastRun(); the next trigger retries
  trigger(): void {
    if (this.running) return
    void this.run().catch(() => { })
  }

  isRunning(): boolean {
    return this.running
  }

  lastRun(): SyncLastRun | null {
    return this.last
  }

  private async doRun(options: SyncOptions, startedAt: EpochMs, failureLines: string[]): Promise<SyncSummary> {
    try {
      const summary = await runSync(this.home, options, {
        onError: (line) => failureLines.push(line),
      })
      if (summary.insertedVisits > 0) this.broadcast('db.changed', {})
      this.recordLast(startedAt, {
        ok: summary.failures === 0,
        error: failureLines.length === 0 ? null : failureLines.join(' | '),
        attempted: summary.attempted,
        failures: summary.failures,
        insertedVisits: summary.insertedVisits,
        touchedUrls: summary.touchedUrls,
      })
      return summary
    } catch (error) {
      // setup can reject (db open, migrations) — record it, then surface
      this.recordLast(startedAt, {
        ok: false,
        error: error instanceof Error ? error.message : String(error),
        attempted: 0,
        failures: 0,
        insertedVisits: 0,
        touchedUrls: 0,
      })
      throw error
    }
  }

  private recordLast(startedAt: EpochMs, result: Omit<SyncLastRun, 'startedAt' | 'finishedAt'>): void {
    this.last = { startedAt, finishedAt: Date.now(), ...result }
  }
}
