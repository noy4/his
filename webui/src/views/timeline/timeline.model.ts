import { computed, effect, signal } from '@preact/signals-react'
import type { HisApi, HistoryItem } from '../../api'
import { dayKey, dayLabel } from '../../lib/dates'

const PAGE_SIZE = 60

export class TimelineModel {
  readonly api: HisApi
  readonly items = signal<HistoryItem[]>([])
  readonly cursor = signal<string | null>(null)
  readonly loading = signal(false)
  readonly done = signal(false)
  readonly sentinel = signal<Element | null>(null)
  readonly groups = computed(() => groupByDay(this.items.value))
  private loaded = false

  constructor(api: HisApi) {
    this.api = api
  }

  setSentinel = (el: Element | null): void => {
    this.sentinel.value = el
  }

  subscribe(): () => void {
    void this.load()
    const unsubs: (() => void)[] = [this.watchSentinel()]
    return () => {
      unsubs.forEach((fn) => fn())
    }
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

  async load(): Promise<void> {
    if (this.loaded) return
    this.loaded = true
    await this.fetchNext()
  }

  async loadMore(): Promise<void> {
    if (!this.loaded || this.done.value || this.loading.value) return
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

interface DayGroup {
  key: string
  label: string
  items: HistoryItem[]
}

function groupByDay(items: HistoryItem[]): DayGroup[] {
  const groups: DayGroup[] = []
  const byKey = new Map<string, DayGroup>()
  for (const item of items) {
    const key = dayKey(item.lastVisit)
    let g = byKey.get(key)
    if (!g) {
      g = { key, label: dayLabel(item.lastVisit), items: [] }
      byKey.set(key, g)
      groups.push(g)
    }
    g.items.push(item)
  }
  return groups
}
