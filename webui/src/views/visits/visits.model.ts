import type { HisApi, HistoryVisit } from '@/app/api'
import { FilterModel } from '@/lib/signal/filter'
import { batch, effect, signal } from '@preact/signals-react'

const PAGE_SIZE = 60

export class VisitsModel {
  readonly filters = new FilterModel()
  readonly items = signal<HistoryVisit[]>([])
  readonly cursor = signal<string | null>(null)
  readonly loading = signal(false)
  readonly done = signal(false)
  readonly sentinel = signal<Element | null>(null)
  readonly view = signal('list')
  #api: Pick<HisApi, 'searchVisits'>
  #requestId = 0

  constructor(api: Pick<HisApi, 'searchVisits'>) {
    this.#api = api
  }

  setSentinel = (el: Element | null): void => {
    this.sentinel.value = el
  }

  setView = (next: string): void => {
    this.view.value = next
  }

  subscribe(): () => void {
    const unsubs = [
      this.filters.subscribe(() => void this.reload()),
      this.watchSentinel(),
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
      const page = await this.#api.searchVisits({
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

  private watchSentinel(): () => void {
    return effect(() => {
      const el = this.sentinel.value
      if (!el || this.done.value || this.items.value.length === 0) return
      const observer = new IntersectionObserver(
        (entries) => {
          if (entries.some((entry) => entry.isIntersecting)) void this.loadMore()
        },
        { rootMargin: '240px 0px' },
      )
      observer.observe(el)
      return () => observer.disconnect()
    })
  }
}
