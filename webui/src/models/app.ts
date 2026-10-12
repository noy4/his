import type { HisApi } from '@/api'
import { signal } from '@preact/signals-react'
import { HistoryModel } from '@/models/history'
import { SourcesModel } from '@/models/sources'
import { createApi } from '@/rpc/client'

export class AppModel {
  readonly api: HisApi
  readonly view = signal('dashboard')
  readonly history: HistoryModel
  readonly sources: SourcesModel

  constructor(api = createApi()) {
    this.api = api
    this.history = new HistoryModel(api)
    this.sources = new SourcesModel(api)
  }

  setView(next: string): void {
    this.view.value = next
  }
}
