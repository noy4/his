import type { HisApi } from '@/api'
import { signal } from '@preact/signals-react'
import { HistoryModel } from '@/models/history'
import { SourcesModel } from '@/models/sources'
import { createApi } from '@/rpc/client'

export class AppModel {
  readonly api: HisApi
  readonly view = signal('timeline')
  readonly filters: FilterModel
  readonly history: HistoryModel
  readonly sources: SourcesModel

  constructor(api = createApi()) {
    this.api = api
    this.filters = new FilterModel()
    this.history = new HistoryModel(api, {
      query: this.filters.query,
      from: this.filters.from,
      to: this.filters.to,
    })
    this.sources = new SourcesModel()
  }

  setView(next: string): void {
    this.view.value = next
  }
}

const SEARCH_DEBOUNCE_MS = 300

export class FilterModel {
  readonly input = signal('')
  readonly query = signal('')
  readonly from = signal<number | null>(null)
  readonly to = signal<number | null>(null)
  #debounce: ReturnType<typeof setTimeout> | undefined

  setInput(next: string): void {
    this.input.value = next
    clearTimeout(this.#debounce)
    this.#debounce = setTimeout(() => {
      this.query.value = next.trim()
    }, SEARCH_DEBOUNCE_MS)
  }

  setRange(from: number | null, to: number | null): void {
    this.from.value = from
    this.to.value = to
  }

  clear(): void {
    clearTimeout(this.#debounce)
    this.input.value = ''
    this.query.value = ''
    this.from.value = null
    this.to.value = null
  }
}
