import { signal } from '@preact/signals-react'
import type { HisApi, SourceProfile, SyncSummary } from '@/app/api'

export function sourceKey(source: SourceProfile): string {
  return `${source.browser}:${source.profile}`
}

export class SourcesModel {
  readonly api: HisApi
  readonly sources = signal<SourceProfile[]>([])
  readonly selected = signal<Set<string>>(new Set())
  readonly running = signal(false)
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
    this.sources.value = await this.api.sourcesList({ check: true })
  }

  syncAll(): void {
    void this.#sync(this.sources.value.map(sourceKey))
  }

  syncSelected(): void {
    void this.#sync([...this.selected.value])
  }

  async #sync(keys: string[]): Promise<void> {
    if (this.running.value || keys.length === 0) return
    this.running.value = true
    try {
      this.lastSync.value = await this.api.syncRun({ targets: keys })
      await this.reload()
      this.clearSelection()
    } catch {
      // sync failures surface through sync.status once wired
    } finally {
      this.running.value = false
    }
  }

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
}
