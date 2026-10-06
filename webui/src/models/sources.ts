import { signal } from '@preact/signals-react'

export interface SourceProfile {
  id: number
  browser: string
  profile: string
  kind: string
  displayName: string | null
  visits: number
  lastVisit: number | null
  lastRunAt: number | null
}

export interface SyncSummary {
  attempted: number
  synced: number
  skipped: number
  insertedVisits: number
}

export function sourceKey(source: SourceProfile): string {
  return `${source.browser}:${source.profile}`
}

const DAY = 86_400_000
const HOUR = 3_600_000
const SYNC_DELAY_MS = 600

const NOW = Date.now()

const SAMPLES: SourceProfile[] = [
  { id: 1, browser: 'brave', profile: 'Default', kind: 'chromium', displayName: 'Brave (Default)', visits: 26463, lastVisit: NOW - 4 * HOUR, lastRunAt: NOW - 4 * HOUR },
  { id: 2, browser: 'chrome', profile: 'Default', kind: 'chromium', displayName: 'Google Chrome (Default)', visits: 185, lastVisit: NOW - 23 * DAY, lastRunAt: NOW - 23 * DAY },
  { id: 3, browser: 'vivaldi', profile: 'Default', kind: 'chromium', displayName: 'Vivaldi (Default)', visits: 23, lastVisit: NOW - 5 * DAY, lastRunAt: NOW - 5 * DAY },
  { id: 4, browser: 'safari', profile: 'default', kind: 'safari', displayName: null, visits: 7, lastVisit: NOW - 87 * DAY, lastRunAt: NOW - 60 * DAY },
  { id: 5, browser: 'firefox', profile: 'vpw8f8gt.default-release', kind: 'firefox', displayName: null, visits: 2, lastVisit: NOW - 300 * DAY, lastRunAt: NOW - 40 * DAY },
  { id: 6, browser: 'takeout', profile: 'History-2026-09-30', kind: 'takeout', displayName: 'Takeout (History.json)', visits: 0, lastVisit: null, lastRunAt: null },
]

function hash(text: string): number {
  let h = 0
  for (let i = 0; i < text.length; i++) h = (h * 31 + text.charCodeAt(i)) | 0
  return Math.abs(h)
}

// UI-first stand-in: static samples and a simulated run until the RPC
// (sources.list / sync.run) is wired — the shape mirrors the planned contract.
export class SourcesModel {
  readonly sources = signal<SourceProfile[]>(freshSamples())
  readonly selected = signal<Set<string>>(new Set())
  readonly running = signal(false)
  readonly lastSync = signal<SyncSummary | null>(null)

  toggle(key: string): void {
    const next = new Set(this.selected.value)
    if (next.has(key)) next.delete(key)
    else next.add(key)
    this.selected.value = next
  }

  selectAll(): void {
    this.selected.value = new Set(this.sources.value.map(sourceKey))
  }

  clearSelection(): void {
    this.selected.value = new Set()
  }

  reload(): void {
    this.sources.value = freshSamples()
    this.lastSync.value = null
    this.clearSelection()
  }

  syncAll(): void {
    this.#sync(this.sources.value.map(sourceKey))
  }

  syncSelected(): void {
    this.#sync([...this.selected.value])
  }

  #sync(keys: string[]): void {
    if (this.running.value || keys.length === 0) return
    this.running.value = true
    const targets = this.sources.value.filter((s) => keys.includes(sourceKey(s)))
    setTimeout(() => {
      let synced = 0
      let skipped = 0
      let inserted = 0
      const runAt = Date.now()
      for (const source of targets) {
        if (source.browser === 'firefox') {
          skipped += 1
          continue
        }
        const bump = 1 + (hash(sourceKey(source)) % 800)
        source.visits += bump
        source.lastVisit = runAt - (hash(source.profile) % HOUR)
        source.lastRunAt = runAt
        inserted += bump
        synced += 1
      }
      this.sources.value = [...this.sources.value]
      this.lastSync.value = {
        attempted: targets.length,
        synced,
        skipped,
        insertedVisits: inserted,
      }
      this.clearSelection()
      this.running.value = false
    }, SYNC_DELAY_MS)
  }
}

function freshSamples(): SourceProfile[] {
  return SAMPLES.map((s) => ({ ...s }))
}
