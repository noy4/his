import { signal } from '@preact/signals-react'
import type { HisApi, Stats } from '@/app/api'
import { PeriodModel } from '@/lib/period/period.model'

export class DashboardModel {
  readonly api: HisApi
  readonly period: PeriodModel
  readonly stats = signal<Stats | null>(null)
  #request = 0
  #started = false

  constructor(api: HisApi) {
    this.api = api
    this.period = new PeriodModel({ onChange: () => this.reload() })
  }

  subscribe(): () => void {
    if (!this.#started) {
      this.#started = true
      this.reload()
    }
    return () => { }
  }

  async reload(): Promise<void> {
    const id = ++this.#request
    const result = await this.api.history.stats(this.period.month)
    if (id === this.#request) this.stats.value = result
  }
}
