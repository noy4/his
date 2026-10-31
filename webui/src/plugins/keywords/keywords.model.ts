import { signal } from '@preact/signals-react'
import type { HistoryItem, KeywordStats } from '@his/core'
import type { RpcCall } from '@/lib/rpc-transport'
import { PeriodModel } from '@/lib/period/period.model'
import { SentinelModel } from '@/lib/sentinel/sentinel.model'
import { keywordsApi } from './api'

const PAGE = 30

export class KeywordsModel {
  readonly api: ReturnType<typeof keywordsApi>
  readonly period: PeriodModel
  readonly stats = signal<KeywordStats | null>(null)
  readonly visits = signal<HistoryItem[]>([])
  readonly nextCursor = signal<string | null>(null)
  readonly sentinel: SentinelModel
  #statsReq = 0
  #visitsReq = 0

  constructor(rpc: RpcCall) {
    this.api = keywordsApi(rpc)
    this.period = new PeriodModel({ onChange: () => this.reload() })
    this.sentinel = new SentinelModel({
      onLoad: () => this.loadMore(),
      ready: () => this.nextCursor.value !== null
        && this.visits.value.length > 0,
    })
  }

  subscribe(): () => void {
    this.reload()
    return this.sentinel.subscribe()
  }

  loadMore(): void {
    this.loadVisits({ append: true })
  }

  async reload(): Promise<void> {
    const id = ++this.#statsReq
    const visits = this.loadVisits()
    const result = await this.api.stats({ month: this.period.month })
    if (id === this.#statsReq) this.stats.value = result
    await visits
  }

  async loadVisits({ append = false }: { append?: boolean } = {}): Promise<void> {
    const id = ++this.#visitsReq
    const cursor = append ? this.nextCursor.value ?? undefined : undefined
    if (append && !cursor) return
    const page = await this.api.search({ month: this.period.month, cursor, limit: PAGE })
    if (id !== this.#visitsReq) return
    this.visits.value = append ? [...this.visits.value, ...page.items] : page.items
    this.nextCursor.value = page.nextCursor
  }
}
