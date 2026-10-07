import { signal } from '@preact/signals-react'
import type { HisApi, Stats } from '@/api'
import dayjs from 'dayjs'

export type DashboardMode = 'month' | 'all'

export class DashboardModel {
  readonly api: HisApi
  readonly mode = signal<DashboardMode>('month')
  readonly monthKey = signal(dayjs().format('YYYY-MM'))
  readonly stats = signal<Stats | null>(null)
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

  async reload(): Promise<void> {
    this.stats.value = await this.api.stats()
  }

  setMode(next: DashboardMode): void {
    this.mode.value = next
  }

  setMonthKey(next: string): void {
    this.monthKey.value = next
  }

  shiftMonth(delta: number): void {
    const next = dayjs(`${this.monthKey.value}-01`).add(delta, 'month')
    this.monthKey.value = next.format('YYYY-MM')
  }
}
