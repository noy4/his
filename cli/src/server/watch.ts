import fs from 'node:fs'
import { discoverTargets, SYNC_KINDS } from '../sync.ts'
import type { SyncRunner } from './runner.ts'

// --- contract ---

// Periodically (default every 6h) fingerprints the discovered browser
// profile DBs (mtime/size, sidecars included) and triggers a debounced full
// sync through the runner only when something changed since the previous
// check. The live DBs are never opened — only stat'ed. Startup catch-up is
// the runner's job at serve spawn (see index.ts).
export interface WatchOptions {
  home: string
  runner: SyncRunner
  pollInterval?: number
  debounce?: number
}

export interface WatchHandle {
  stop(): void
}

const POLL_INTERVAL = 6 * 60 * 60 * 1000
const DEBOUNCE = 5_000
const SQLITE_SIDECARS = ['-wal', '-shm', '-journal']

interface Fingerprint {
  mtimeMs: number
  size: number
}

export function startWatchLoop(options: WatchOptions): WatchHandle {
  const { home, runner } = options
  const pollInterval = options.pollInterval ?? POLL_INTERVAL
  const debounce = options.debounce ?? DEBOUNCE
  const fingerprints = new Map<string, Fingerprint | null>()

  let debounceTimer: NodeJS.Timeout | undefined

  function scan(trigger: boolean): void {
    let changed = false
    for (const kind of SYNC_KINDS) {
      let targets
      try {
        targets = discoverTargets(kind, home)
      } catch {
        continue // unreadable source kind — skip till next poll
      }
      for (const target of targets) {
        for (const file of watchFiles(target.dbPath)) {
          const current = statFile(file)
          if (fingerprintChanged(fingerprints.get(file), current)) changed = true
          fingerprints.set(file, current)
        }
      }
    }
    if (changed && trigger) arm()
  }

  function arm(): void {
    clearTimeout(debounceTimer)
    debounceTimer = setTimeout(fire, debounce)
    debounceTimer.unref()
  }

  function fire(): void {
    debounceTimer = undefined
    if (runner.isRunning()) {
      arm() // single-flight runner is busy — queue behind it
      return
    }
    try {
      runner.run({})
    } catch {
      // Local fs failure — the next detected change retriggers.
    }
  }

  scan(false) // prime the baseline without triggering
  const timer = setInterval(() => scan(true), pollInterval)
  timer.unref()

  return {
    stop(): void {
      clearInterval(timer)
      clearTimeout(debounceTimer)
    },
  }
}

// --- helpers ---

// Main DB plus sidecars: a live browser mostly writes into -wal, so stat'ing
// the main file alone would miss updates. Stating all three catches writes.
function watchFiles(dbPath: string): string[] {
  if (dbPath.endsWith('.json')) return [dbPath]
  return [dbPath, ...SQLITE_SIDECARS.map((ext) => dbPath + ext)]
}

function statFile(file: string): Fingerprint | null {
  try {
    const stats = fs.statSync(file, { throwIfNoEntry: false })
    return stats === undefined ? null : { mtimeMs: stats.mtimeMs, size: stats.size }
  } catch {
    return null // unreadable (permissions) — treat as absent
  }
}

function fingerprintChanged(previous: Fingerprint | null | undefined, current: Fingerprint | null): boolean {
  if (previous === undefined) return true // first sighting
  if (previous === null || current === null) return previous !== current // (dis)appearance
  return previous.mtimeMs !== current.mtimeMs || previous.size !== current.size
}
