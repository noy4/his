import { signal } from '@preact/signals-react'
import { PeriodModel } from '@/lib/period/period.model'
import { dummyKeywordStats, dummyRecentKeywords, type KeywordEvent, type KeywordStats } from './keywords.data'

const PAGE = 30

export class KeywordsModel {
  readonly period: PeriodModel
  readonly stats = signal<KeywordStats | null>(null)
  readonly recent = signal<KeywordEvent[]>([])
  readonly nextOffset = signal<number | null>(null)

  constructor() {
    this.period = new PeriodModel({ onChange: () => this.reload() })
  }

  subscribe(): void {
    this.reload()
  }

  loadMore(): void {
    const offset = this.nextOffset.value
    if (offset === null) return
    const page = dummyRecentKeywords(this.period.month, offset, PAGE)
    this.recent.value = [...this.recent.value, ...page.items]
    this.nextOffset.value = page.nextOffset
  }

  reload(): void {
    this.stats.value = dummyKeywordStats(this.period.month)
    const page = dummyRecentKeywords(this.period.month, 0, PAGE)
    this.recent.value = page.items
    this.nextOffset.value = page.nextOffset
  }
}
