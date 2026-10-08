import { signal } from '@preact/signals-react'
import type { GithubStats, GithubVisitKind, HisApi, HistoryItem } from '@/api'
import dayjs from 'dayjs'

export type GithubMode = 'month' | 'all'
export type GithubFilter = { owner: string; repo?: string } | null

const PAGE = 30

export class GithubModel {
  readonly api: HisApi
  readonly mode = signal<GithubMode>('month')
  readonly monthKey = signal(dayjs().format('YYYY-MM'))
  readonly stats = signal<GithubStats | null>(null)
  readonly filter = signal<GithubFilter>(null)
  readonly kind = signal<GithubVisitKind>('all')
  readonly visits = signal<HistoryItem[]>([])
  readonly nextCursor = signal<string | null>(null)
  #statsReq = 0
  #visitsReq = 0
  #started = false

  constructor(api: HisApi) {
    this.api = api
  }

  subscribe(): () => void {
    if (!this.#started) {
      this.#started = true
      void this.reload()
    }
    return () => { }
  }

  get month(): string | undefined {
    return this.mode.value === 'month' ? this.monthKey.value : undefined
  }

  setMode(next: GithubMode): void {
    if (this.mode.value === next) return
    this.mode.value = next
    void this.reload()
  }

  shiftMonth(delta: number): void {
    this.monthKey.value = dayjs(`${this.monthKey.value}-01`).add(delta, 'month').format('YYYY-MM')
    if (this.mode.value === 'month') void this.reload()
  }

  setFilter(next: GithubFilter): void {
    this.filter.value = next
    void this.loadVisits(false)
  }

  setKind(next: GithubVisitKind): void {
    if (this.kind.value === next) return
    this.kind.value = next
    void this.loadVisits(false)
  }

  loadMore(): void {
    void this.loadVisits(true)
  }

  async reload(): Promise<void> {
    const id = ++this.#statsReq
    const visits = this.loadVisits(false)
    const result = await this.api.githubStats(this.month)
    if (id === this.#statsReq) this.stats.value = result
    await visits
  }

  async loadVisits(append: boolean): Promise<void> {
    const id = ++this.#visitsReq
    const cursor = append ? this.nextCursor.value ?? undefined : undefined
    if (append && !cursor) return
    const f = this.filter.value
    const page = await this.api.githubVisits({
      month: this.month,
      owner: f?.owner,
      repo: f?.repo,
      kind: this.kind.value,
      cursor,
      limit: PAGE,
    })
    if (id !== this.#visitsReq) return
    this.visits.value = append ? [...this.visits.value, ...page.items] : page.items
    this.nextCursor.value = page.nextCursor
  }
}
