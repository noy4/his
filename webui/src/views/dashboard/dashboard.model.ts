import { signal } from '@preact/signals-react'
import type { HisApi, Stats } from '@/api'
import dayjs from 'dayjs'

export type DashboardMode = 'month' | 'all'

export class DashboardModel {
  readonly api: HisApi
  readonly mode = signal<DashboardMode>('month')
  readonly monthKey = signal(dayjs().format('YYYY-MM'))
  readonly stats = signal<Stats | null>(null)
  #request = 0
  #started = false

  constructor(api: HisApi) {
    this.api = api
  }

  subscribe(): () => void {
    if (!this.#started) {
      this.#started = true
      void this.reload()
    }
    return () => { }
  }

  setMode(next: DashboardMode): void {
    if (this.mode.value === next) return
    this.mode.value = next
    void this.reload()
  }

  setMonthKey(next: string): void {
    if (this.monthKey.value === next) return
    this.monthKey.value = next
    if (this.mode.value === 'month') void this.reload()
  }

  shiftMonth(delta: number): void {
    const next = dayjs(`${this.monthKey.value}-01`).add(delta, 'month')
    this.setMonthKey(next.format('YYYY-MM'))
  }

  async reload(): Promise<void> {
    const month = this.mode.value === 'month' ? this.monthKey.value : undefined
    const id = ++this.#request
    const result = await this.api.stats(month)
    if (id === this.#request) this.stats.value = result
  }
}
