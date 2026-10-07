import type { EpochMs, SyncLastRun, SyncOptions, SyncSummary } from '@his/core'
import { runSync } from '@his/core'

export interface SyncRunnerOptions {
  home: string
}

// In-process sync state: single-flight guard, last-run record.
export class SyncRunner {
  private readonly home: string
  private running = false
  private last: SyncLastRun | null = null

  constructor(options: SyncRunnerOptions) {
    this.home = options.home
  }

  async run(options: SyncOptions = {}): Promise<SyncSummary> {
    if (this.running) throw new Error('sync already running')
    // set before the first await so concurrent callers see the guard
    this.running = true
    const startedAt = Date.now()
    try {
      const summary = await runSync(this.home, options)
      this.recordLast(startedAt, {
        ok: summary.failures === 0,
        error: summary.errors.length === 0 ? null : summary.errors.join(' | '),
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
    } finally {
      this.running = false
    }
  }

  // fire-and-forget; skips if busy, errors go to lastRun()
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

  private recordLast(startedAt: EpochMs, result: Omit<SyncLastRun, 'startedAt' | 'finishedAt'>): void {
    this.last = { startedAt, finishedAt: Date.now(), ...result }
  }
}
