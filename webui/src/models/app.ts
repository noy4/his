import { signal } from '@preact/signals-react'
import type { HisApi } from '../api'
import { mockApi } from '../mock/api'

export class AppModel {
  readonly api: HisApi
  readonly view = signal('timeline')
  readonly query = signal('')

  constructor(api: HisApi = mockApi) {
    this.api = api
  }

  setView(next: string): void {
    this.view.value = next
  }

  setQuery(next: string): void {
    this.query.value = next
  }
}
