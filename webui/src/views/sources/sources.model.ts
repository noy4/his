import { signal } from '@preact/signals-react'
import type { HisApi, SourceEntry, SyncSummary } from '@/app/api'
import { sourceKey } from '@his/core'

export type { SourceEntry } from '@/app/api'

export class SourcesModel {
  readonly api: HisApi
  readonly entries = signal<SourceEntry[]>([])
  /** configured sync targets */
  readonly enabled = signal<Set<string>>(new Set())
  readonly running = signal(false)
  readonly saving = signal(false)
  readonly error = signal<string | null>(null)
  readonly lastSync = signal<SyncSummary | null>(null)
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
    const [entries, settings] = await Promise.all([
      this.api.sourcesList({ check: true }),
      this.api.settings.get(),
    ])
    this.entries.value = entries
    this.enabled.value = new Set(settings.syncTargets)
  }

  toggle = (key: string): void => {
    const next = new Set(this.enabled.value)
    if (next.has(key)) next.delete(key)
    else next.add(key)
    this.#applyTargets(next)
  }

  selectAll = (): void => {
    this.#applyTargets(new Set(this.entries.value.map(sourceKey)))
  }

  clearSelection = (): void => {
    this.#applyTargets(new Set())
  }

  syncAll(): void {
    void this.#sync(this.entries.value.map(sourceKey))
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
    this.saving.value = true
    this.error.value = null
    try {
      const info = await this.api.settings.set({ syncTargets: [...next] })
      this.enabled.value = new Set(info.syncTargets)
    } catch {
      this.error.value = 'Could not save sync targets'
      await this.reload().catch(() => {})
    } finally {
      this.saving.value = false
    }
  }

  async #sync(keys: string[]): Promise<void> {
    if (this.running.value || keys.length === 0) return
    this.running.value = true
    try {
      this.lastSync.value = await this.api.syncRun({ targets: keys })
      await this.reload()
    } catch {
      // sync failures surface through sync.status once wired
    } finally {
      this.running.value = false
    }
  }
}
