import type { HisApi, HistoryVisit } from '@/app/api'
import { FilterModel } from '@/lib/signal/filter'
import { SentinelModel } from '@/lib/sentinel/sentinel.model'
import { batch, signal } from '@preact/signals-react'

const PAGE_SIZE = 60

export class VisitsModel {
  readonly filters = new FilterModel()
  readonly items = signal<HistoryVisit[]>([])
  readonly cursor = signal<string | null>(null)
  readonly loading = signal(false)
  readonly done = signal(false)
  readonly sentinel: SentinelModel
  readonly view = signal('list')
  #api: { history: Pick<HisApi['history'], 'searchVisits'> }
  #requestId = 0

  constructor(api: { history: Pick<HisApi['history'], 'searchVisits'> }) {
    this.#api = api
    this.sentinel = new SentinelModel({
      onLoad: () => this.loadMore(),
      ready: () => !this.done.value && this.items.value.length > 0,
    })
  }

  setView = (next: string): void => {
    this.view.value = next
  }

  subscribe(): () => void {
    const unsubs = [
      this.filters.subscribe(() => this.reload()),
      this.sentinel.subscribe(),
    ]
    return () => unsubs.forEach((unsub) => unsub())
  }

  reload(): Promise<void> {
    this.#requestId += 1
    return batch(() => {
      this.items.value = []
      this.cursor.value = null
      this.done.value = false
      this.loading.value = false
      return this.loadMore()
    })
  }

  async loadMore(): Promise<void> {
    if (this.loading.peek() || this.done.peek()) return
    const requestId = this.#requestId
    this.loading.value = true
    try {
      const page = await this.#api.history.searchVisits({
        query: this.filters.query.peek() || undefined,
        from: this.filters.from.peek() ?? undefined,
        to: this.filters.to.peek() ?? undefined,
        cursor: this.cursor.peek() ?? undefined,
        limit: PAGE_SIZE,
      })
      if (requestId !== this.#requestId) return
      batch(() => {
        const known = new Set(this.items.peek().map((visit) => visit.id))
        this.items.value = [...this.items.peek(), ...page.items.filter((visit) => !known.has(visit.id))]
        this.cursor.value = page.nextCursor
        this.done.value = page.nextCursor === null
      })
    } finally {
      if (requestId === this.#requestId) this.loading.value = false
    }
  }
}
