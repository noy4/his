import type { HisApi } from '@/app/api'
import { signal } from '@preact/signals-react'
import { createApi } from '@/app/client'

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
