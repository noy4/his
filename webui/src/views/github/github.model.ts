import { signal } from '@preact/signals-react'
import type { GithubStats, GithubVisitKind, HisApi, HistoryItem } from '@/app/api'
import { PeriodModel } from '@/lib/signal/period'

export type GithubFilter = { owner: string; repo?: string } | null

const PAGE = 30

export class GithubModel {
  readonly api: HisApi
  readonly period: PeriodModel
  readonly stats = signal<GithubStats | null>(null)
  readonly filter = signal<GithubFilter>(null)
  readonly kind = signal<GithubVisitKind>('repo')
  readonly visits = signal<HistoryItem[]>([])
  readonly nextCursor = signal<string | null>(null)
  readonly view = signal('card')
  #statsReq = 0
  #visitsReq = 0
  #started = false

  constructor(api: HisApi) {
    this.api = api
    this.period = new PeriodModel(() => this.reload())
  }

  subscribe(): () => void {
    if (!this.#started) {
      this.#started = true
      this.reload()
    }
    return () => { }
  }

  setFilter(next: GithubFilter): void {
    this.filter.value = next
    this.loadVisits()
  }

  setKind(next: GithubVisitKind): void {
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

  async reload(): Promise<void> {
    const id = ++this.#statsReq
    const visits = this.loadVisits()
    const result = await this.api.githubStats(this.period.month)
    if (id === this.#statsReq) this.stats.value = result
    await visits
  }

  async loadVisits({ append = false }: { append?: boolean } = {}): Promise<void> {
    const id = ++this.#visitsReq
    const cursor = append ? this.nextCursor.value ?? undefined : undefined
    if (append && !cursor) return
    const f = this.filter.value
    const page = await this.api.githubVisits({
      month: this.period.month,
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
