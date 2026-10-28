import { signal } from '@preact/signals-react'
import type { HisApi, SourceEntry, SyncSummary } from '@/app/api'

export type { SourceEntry } from '@/app/api'

export class SourcesModel {
  readonly api: HisApi
  readonly entries = signal<SourceEntry[]>([])
  readonly enabled = signal<Set<string>>(new Set())
  readonly running = signal(false)
  readonly error = signal<string | null>(null)
  readonly lastSync = signal<SyncSummary | null>(null)
  readonly loaded = signal(false)
  #statusRequest = 0

  constructor(api: HisApi) {
    this.api = api
  }

  subscribe(): () => void {
    this.reload()
    this.#refreshStatus()
    const timer = setInterval(() => this.#refreshStatus(), 30_000)
    return () => clearInterval(timer)
  }

  async reload(): Promise<void> {
    try {
      const [entries, settings] = await Promise.all([
        this.api.sources.list(),
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

  async #refreshStatus(): Promise<void> {
    if (this.running.value) return
    const request = ++this.#statusRequest
    try {
      const status = await this.api.sync.status()
      if (request !== this.#statusRequest) return
      this.lastSync.value = status
      const errors = status?.errors ?? []
      this.error.value = errors.length > 0 ? errors.join('\n') : null
    } catch {
      // Keep the last known status when the server is unavailable.
    }
  }

  // optimistic: update the set now, persist, revert on failure
  #applyTargets(next: Set<string>): void {
    this.enabled.value = next
    void this.#saveTargets(next)
  }

  async #saveTargets(next: Set<string>): Promise<void> {
    try {
      const info = await this.api.settings.set({ sync_targets: [...next] })
      this.enabled.value = new Set(info.sync_targets ?? [])
    } catch {
      this.error.value = 'Could not save sync targets'
      await this.reload().catch(() => { })
    }
  }

  async #sync(keys: string[]): Promise<void> {
    if (this.running.value || keys.length === 0) return
    this.running.value = true
    this.#statusRequest++
    try {
      const summary = await this.api.sync.run({ targets: keys })
      this.lastSync.value = summary
      const errors = summary.errors
      this.error.value = errors.length > 0 ? errors.join('\n') : null
      await this.reload().catch(() => {
        this.error.value = 'Could not refresh sources'
      })
    } catch (error) {
      this.error.value = error instanceof Error ? error.message : String(error)
    } finally {
      this.running.value = false
    }
  }
}
