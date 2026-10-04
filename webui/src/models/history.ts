import { effect, signal } from '@preact/signals-react'
import type { Signal } from '@preact/signals-react'
import type { HisApi, HistoryItem } from '@/api'

const PAGE_SIZE = 60

export interface HistoryFilters {
  query: Signal<string>
  from: Signal<number | null>
  to: Signal<number | null>
}

export class HistoryModel {
  readonly api: HisApi
  readonly items = signal<HistoryItem[]>([])
  readonly cursor = signal<string | null>(null)
  readonly loading = signal(false)
  readonly done = signal(false)
  readonly sentinel = signal<Element | null>(null)
  #filters: HistoryFilters
  #filterKey: string | null = null
  #started = false
  #pending: Promise<void> = Promise.resolve()

  constructor(api: HisApi, filters: HistoryFilters) {
    this.api = api
    this.#filters = filters
  }

  setSentinel = (el: Element | null): void => {
    this.sentinel.value = el
  }

  subscribe(): () => void {
    const unsubs: (() => void)[] = [
      this.watchFilters(),
      this.watchSentinel(),
    ]
    if (!this.#started) {
      this.#started = true
      void this.loadFirst()
    }
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

  async loadFirst(): Promise<void> {
    await this.fetchNext()
  }

  async loadMore(): Promise<void> {
    if (this.done.value || this.items.value.length === 0) return
    await this.fetchNext()
  }

  async delete(item: HistoryItem): Promise<void> {
    await this.api.deleteUrl(item.url)
    this.remove(item.id)
  }

  private remove(id: number): void {
    this.items.value = this.items.value.filter((it) => it.id !== id)
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
      const page = await this.api.search({
        query: this.#filters.query.value || undefined,
        from: this.#filters.from.value ?? undefined,
        to: this.#filters.to.value ?? undefined,
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

  private watchFilters(): () => void {
    return effect(() => {
      const key = [
        this.#filters.query.value,
        this.#filters.from.value,
        this.#filters.to.value,
      ].join('|')
      if (this.#filterKey === null) {
        this.#filterKey = key
        return
      }
      if (key === this.#filterKey) return
      this.#filterKey = key
      void this.reload()
    })
  }

  private watchSentinel(): () => void {
    return effect(() => {
      const el = this.sentinel.value
      if (!el) return
      const io = new IntersectionObserver(
        (entries) => {
          if (entries.some((e) => e.isIntersecting)) void this.loadMore()
        },
        { rootMargin: '240px 0px' },
      )
      io.observe(el)
      return () => io.disconnect()
    })
  }
}
