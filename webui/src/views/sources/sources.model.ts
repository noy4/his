import { signal } from '@preact/signals-react'
import type { HisApi, SourceEntry, SyncSummary } from '@/app/api'

export type { SourceEntry } from '@/app/api'

export class SourcesModel {
  readonly api: HisApi
  readonly entries = signal<SourceEntry[]>([])
  /** configured sync targets */
  readonly enabled = signal<Set<string>>(new Set())
  readonly running = signal(false)
  readonly error = signal<string | null>(null)
  readonly lastSync = signal<SyncSummary | null>(null)
  /** false until the first listing arrives */
  readonly loaded = signal(false)
  #started = false

  constructor(api: HisApi) {
    this.api = api
  }

  subscribe(): () => void {
    if (!this.#started) {
      this.#started = true
      void this.reload()
    }
    return () => {}
  }

  async reload(): Promise<void> {
    try {
      const [entries, settings] = await Promise.all([
        this.api.sources.list({ check: true }),
        this.api.settings.get(),
      ])
      this.entries.value = entries
      this.enabled.value = new Set(settings.sync_targets ?? [])
    } finally {
      this.loaded.value = true
    }
  }

  toggle = (key: string): void => {
    const next = new Set(this.enabled.value)
    if (next.has(key)) next.delete(key)
    else next.add(key)
    this.#applyTargets(next)
  }

  syncSelected(): void {
    void this.#sync([...this.enabled.value])
  }

  // --- internals ---

  // optimistic: update the set now, persist, revert on failure
  #applyTargets(next: Set<string>): void {
    this.enabled.value = next
    void this.#saveTargets(next)
  }

  async #saveTargets(next: Set<string>): Promise<void> {
    this.error.value = null
    try {
      const info = await this.api.settings.set({ sync_targets: [...next] })
      this.enabled.value = new Set(info.sync_targets ?? [])
    } catch {
      this.error.value = 'Could not save sync targets'
      await this.reload().catch(() => {})
    }
  }

  async #sync(keys: string[]): Promise<void> {
    if (this.running.value || keys.length === 0) return
    this.running.value = true
    try {
      this.lastSync.value = await this.api.sync.run({ targets: keys })
      await this.reload()
    } catch {
      // sync failures surface through sync.status once wired
    } finally {
      this.running.value = false
    }
  }
}
