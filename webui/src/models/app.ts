import type { HisApi } from '@/api'
import { signal } from '@preact/signals-react'
import { SourcesModel } from '@/models/sources'
import { createApi } from '@/rpc/client'

export class AppModel {
  readonly api: HisApi
  readonly view = signal('dashboard')
  readonly sources: SourcesModel

  constructor(api = createApi()) {
    this.api = api
    this.sources = new SourcesModel(api)
  }

  setView(next: string): void {
    this.view.value = next
  }
}
