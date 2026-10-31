import { signal } from '@preact/signals-react'
import type { HisApi, HistoryItem, Stats } from '@/app/api'
import { FilterModel } from '@/lib/signal/filter'
import { SentinelModel } from '@/lib/sentinel/sentinel.model'

const PAGE_SIZE = 60

export class UrlsModel {
  readonly api: HisApi
  readonly filters = new FilterModel()
  readonly items = signal<HistoryItem[]>([])
  readonly cursor = signal<string | null>(null)
  readonly loading = signal(false)
  readonly done = signal(false)
  readonly sentinel: SentinelModel
  readonly view = signal('list')
  #pending: Promise<void> = Promise.resolve()

  constructor(api: HisApi) {
    this.api = api
    this.sentinel = new SentinelModel({
      onLoad: () => this.loadMore(),
      ready: () => !this.done.value && this.items.value.length > 0,
    })
  }

  setView = (next: string): void => {
    this.view.value = next
  }

  subscribe(): () => void {
    const unsubs: (() => void)[] = [
      this.filters.subscribe(() => this.reload()),
      this.sentinel.subscribe(),
    ]
    return () => {
      unsubs.forEach((fn) => fn())
    }
  }

  async reload(): Promise<void> {
    try {
      await this.#pending
    } catch {
      // previous failures don't block a fresh reload
    }
    this.items.value = []
    this.cursor.value = null
    this.done.value = false
    await this.fetchNext()
  }

  async loadMore(): Promise<void> {
    if (this.done.value || this.items.value.length === 0) return
    await this.fetchNext()
  }

  stats(): Promise<Stats> {
    return this.api.history.stats()
  }

  private fetchNext(): Promise<void> {
    const run = this.#pending.then(() => this.fetchPage())
    this.#pending = run.catch(() => { })
    return run
  }

  private async fetchPage(): Promise<void> {
    if (this.loading.value || this.done.value) return
    this.loading.value = true
    try {
      const page = await this.api.history.search({
        query: this.filters.query.value || undefined,
        from: this.filters.from.value ?? undefined,
        to: this.filters.to.value ?? undefined,
        cursor: this.cursor.value ?? undefined,
        limit: PAGE_SIZE,
      })
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
