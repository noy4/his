import { signal } from '@preact/signals-react'
import type { HisApi } from '@/app/api'

export class SettingsModel {
  readonly text = signal('')
  readonly saving = signal(false)
  readonly status = signal<string | null>(null)
  readonly hiddenUrlCount = signal<number | null>(null)
  #api: Pick<HisApi, 'settings'>
  #started = false

  constructor(api: HisApi) {
    this.#api = api
  }

  subscribe() {
    if (!this.#started) {
      this.#started = true
      void this.reload()
    }
  }

  setText = (value: string): void => {
    this.text.value = value
    this.status.value = null
  }

  async reload(): Promise<void> {
    try {
      const info = await this.#api.settings.get()
      this.text.value = (info.hidden_patterns ?? []).join('\n')
      this.hiddenUrlCount.value = info.hidden_url_count
    } catch {
      this.status.value = 'Could not load settings'
    }
  }

  async save(): Promise<void> {
    if (this.saving.value) return
    this.saving.value = true
    this.status.value = null
    try {
      const info = await this.#api.settings.set({ hidden_patterns: parsePatterns(this.text.value) })
      this.text.value = (info.hidden_patterns ?? []).join('\n')
      this.hiddenUrlCount.value = info.hidden_url_count
      this.status.value = 'Saved'
    } catch {
      this.status.value = 'Could not save settings'
    } finally {
      this.saving.value = false
    }
  }
}

// --- utils ---

export function parsePatterns(text: string): string[] {
  const seen = new Set<string>()
  for (const line of text.split('\n')) {
    const pattern = line.trim().toLowerCase()
    if (pattern) seen.add(pattern)
  }
  return [...seen]
}
