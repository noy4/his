import type { HisApi } from '@/api'
import { signal } from '@preact/signals-react'
import { createApi } from '@/rpc/client'

export class AppModel {
  readonly api: HisApi
  readonly view = signal('dashboard')

  constructor(api = createApi()) {
    this.api = api
  }

  setView(next: string): void {
    this.view.value = next
  }
}
