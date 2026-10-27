import { signal } from '@preact/signals-react'
import type { HisApi, HistoryItem, YoutubeVisitKind } from '@/app/api'
import dayjs from 'dayjs'

export type YoutubeMode = 'month' | 'all'

const PAGE = 30

export class YoutubeModel {
  readonly api: HisApi
  readonly mode = signal<YoutubeMode>('month')
  readonly monthKey = signal(dayjs().format('YYYY-MM'))
  readonly kind = signal<YoutubeVisitKind>('video')
  readonly visits = signal<HistoryItem[]>([])
  readonly nextCursor = signal<string | null>(null)
  readonly view = signal('card')
  #req = 0
  #started = false

  constructor(api: HisApi) {
    this.api = api
  }

  subscribe(): () => void {
    if (!this.#started) {
      this.#started = true
      void this.loadVisits(false)
    }
    return () => { }
  }

  get month(): string | undefined {
    return this.mode.value === 'month' ? this.monthKey.value : undefined
  }

  setMode(next: YoutubeMode): void {
    if (this.mode.value === next) return
    this.mode.value = next
    void this.loadVisits(false)
  }

  shiftMonth(delta: number): void {
    this.monthKey.value = dayjs(`${this.monthKey.value}-01`).add(delta, 'month').format('YYYY-MM')
    if (this.mode.value === 'month') void this.loadVisits(false)
  }

  setKind(next: YoutubeVisitKind): void {
    if (this.kind.value === next) return
    this.kind.value = next
    void this.loadVisits(false)
  }

  setView(next: string): void {
    this.view.value = next
  }

  loadMore(): void {
    void this.loadVisits(true)
  }

  async loadVisits(append: boolean): Promise<void> {
    const id = ++this.#req
    const cursor = append ? this.nextCursor.value ?? undefined : undefined
    if (append && !cursor) return
    const page = await this.api.youtubeVisits({
      month: this.month,
      kind: this.kind.value,
      cursor,
      limit: PAGE,
    })
    if (id !== this.#req) return
    this.visits.value = append ? [...this.visits.value, ...page.items] : page.items
    this.nextCursor.value = page.nextCursor
  }
}
