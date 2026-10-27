import { signal } from '@preact/signals-react'
import type { HisApi, HistoryItem, YoutubeVisitKind } from '@/app/api'
import { PeriodModel } from '@/lib/period/period.model'

const PAGE = 30

export class YoutubeModel {
  readonly api: HisApi
  readonly period: PeriodModel
  readonly kind = signal<YoutubeVisitKind>('video')
  readonly visits = signal<HistoryItem[]>([])
  readonly nextCursor = signal<string | null>(null)
  readonly view = signal('card')
  #req = 0
  #started = false

  constructor(api: HisApi) {
    this.api = api
    this.period = new PeriodModel({ onChange: () => this.loadVisits() })
  }

  subscribe(): () => void {
    if (!this.#started) {
      this.#started = true
      this.loadVisits()
    }
    return () => { }
  }

  setKind(next: YoutubeVisitKind): void {
    if (this.kind.value === next) return
    this.kind.value = next
    this.loadVisits()
  }

  setView(next: string): void {
    this.view.value = next
  }

  loadMore(): void {
    this.loadVisits({ append: true })
  }

  async loadVisits({ append = false }: { append?: boolean } = {}): Promise<void> {
    const id = ++this.#req
    const cursor = append ? this.nextCursor.value ?? undefined : undefined
    if (append && !cursor) return
    const page = await this.api.youtubeVisits({
      month: this.period.month,
      kind: this.kind.value,
      cursor,
      limit: PAGE,
    })
    if (id !== this.#req) return
    this.visits.value = append ? [...this.visits.value, ...page.items] : page.items
    this.nextCursor.value = page.nextCursor
  }
}
