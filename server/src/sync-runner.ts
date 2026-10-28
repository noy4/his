import type { SyncOptions, SyncSummary } from '@his/core/node'
import { runSync } from '@his/core/node'

const SYNC_INTERVAL = 6 * 60 * 60 * 1000

export interface SyncRunnerOptions {
  home: string
}

// In-process sync state: single-flight guard, last-run record.
export class SyncRunner {
  private readonly home: string
  private running = false
  lastSummary: SyncSummary | null = null

  constructor(options: SyncRunnerOptions) {
    this.home = options.home
  }

  async run(options: SyncOptions = {}): Promise<SyncSummary> {
    if (this.running) throw new Error('sync already running')
    // set before the first await so concurrent callers see the guard
    this.running = true
    const startedAt = Date.now()
    try {
      this.lastSummary = await runSync(this.home, options)
      return this.lastSummary
    } catch (error) {
      this.lastSummary = {
        startedAt,
        finishedAt: Date.now(),
        errors: [error instanceof Error ? error.message : String(error)],
        attempted: 0,
        failures: 0,
        skipped: 0,
        insertedVisits: 0,
        touchedUrls: 0,
      }
      throw error
    } finally {
      this.running = false
    }
  }

  // fire-and-forget; skips if busy, errors go to lastSummary
  trigger(): void {
    if (this.running) return
    void this.run().catch(() => { })
  }

  // triggers every interval (default 6h)
  schedule(interval = SYNC_INTERVAL): () => void {
    const timer = setInterval(() => this.trigger(), interval)
    timer.unref()
    return () => clearInterval(timer)
  }
}
