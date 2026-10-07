import type { SyncRunner } from './sync-runner.ts'

// Triggers sync every 6h; change detection is sync's job.

export interface PeriodicSyncHandle {
  stop(): void
}

const SYNC_INTERVAL = 6 * 60 * 60 * 1000

export function startPeriodicSync(runner: SyncRunner, interval?: number): PeriodicSyncHandle {
  function tick(): void {
    runner.trigger()
  }
  const timer = setInterval(tick, interval ?? SYNC_INTERVAL)
  timer.unref()
  return {
    stop(): void {
      clearInterval(timer)
    },
  }
}
