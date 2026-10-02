import { signal } from '@preact/signals-react'
import type { HisApi, HistoryItem } from '../api'

const PAGE_SIZE = 60

export class TimelineModel {
  readonly api: HisApi
  items = signal<HistoryItem[]>([])
  cursor = signal<string | null>(null)
  loading = signal(false)
  done = signal(false)
  private started = false

  constructor(api: HisApi) {
    this.api = api
  }

  subscribe() {
    void this.start()
  }

  async start(): Promise<void> {
    if (this.started) return
    this.started = true
    await this.fetchNext()
  }

  async loadMore(): Promise<void> {
    if (!this.started || this.done.value || this.loading.value) return
    await this.fetchNext()
  }

  private async fetchNext(): Promise<void> {
    if (this.loading.value) return
    this.loading.value = true
    try {
      const page = await this.api.search({ cursor: this.cursor.value ?? undefined, limit: PAGE_SIZE })
      const known = new Set(this.items.value.map((it) => it.id))
      const fresh = page.items.filter((it) => !known.has(it.id))
      this.items.value = [...this.items.value, ...fresh]
      this.cursor.value = page.nextCursor
      if (page.nextCursor === null) this.done.value = true
    } finally {
      this.loading.value = false
    }
  }
}
