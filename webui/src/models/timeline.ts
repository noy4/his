import { effect, signal } from '@preact/signals-react'
import type { HisApi, HistoryItem } from '../api'

const PAGE_SIZE = 60

export class TimelineModel {
  readonly api: HisApi
  readonly items = signal<HistoryItem[]>([])
  readonly cursor = signal<string | null>(null)
  readonly loading = signal(false)
  readonly done = signal(false)
  readonly sentinel = signal<Element | null>(null)
  private io: IntersectionObserver | null = null
  private started = false

  constructor(api: HisApi) {
    this.api = api
  }

  setSentinel(el: Element | null): void {
    this.sentinel.value = el
  }

  subscribe(): () => void {
    void this.start()
    const watchSentinel = effect(() => {
      this.io?.disconnect()
      this.io = null
      const el = this.sentinel.value
      if (!el) return
      this.io = new IntersectionObserver(
        (entries) => {
          if (entries.some((e) => e.isIntersecting)) void this.loadMore()
        },
        { rootMargin: '240px 0px' },
      )
      this.io.observe(el)
    })
    return () => {
      watchSentinel()
      this.io?.disconnect()
      this.io = null
    }
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
