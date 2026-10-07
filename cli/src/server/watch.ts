import type { SyncRunner } from './sync-runner.ts'

// --- contract ---

// Ticks the runner's change-gated sync every 6h while serve lives. Change
// detection lives inside sync.ts (per-target fingerprints, persisted in the
// DB) — this only paces the runs. Startup catch-up is called at serve spawn
// (see index.ts).
export interface PeriodicSyncOptions {
  runner: SyncRunner
  interval?: number
}

export interface PeriodicSyncHandle {
  stop(): void
}

const SYNC_INTERVAL = 6 * 60 * 60 * 1000

export function startPeriodicSync(options: PeriodicSyncOptions): PeriodicSyncHandle {
  const timer = setInterval(tick, options.interval ?? SYNC_INTERVAL)
  timer.unref()
  function tick(): void {
    // failures land on lastRun(); the next tick retries anyway
    options.runner.trigger()
  }
  return {
    stop(): void {
      clearInterval(timer)
    },
  }
}
