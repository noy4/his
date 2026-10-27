import { signal } from '@preact/signals-react'
import dayjs from 'dayjs'

export type PeriodMode = 'month' | 'all'

const MONTH_FORMAT = 'YYYY-MM'

export class PeriodModel {
  readonly mode = signal<PeriodMode>('month')
  readonly monthKey = signal(dayjs().format(MONTH_FORMAT))
  #onChange: () => void

  constructor({ onChange }: { onChange: () => void }) {
    this.#onChange = onChange
  }

  // effective month — undefined in 'all' mode
  get month(): string | undefined {
    return this.mode.value === 'month' ? this.monthKey.value : undefined
  }

  setMode(next: PeriodMode): void {
    if (this.mode.value === next) return
    this.mode.value = next
    this.#onChange()
  }

  shiftMonth(delta: number): void {
    this.monthKey.value = dayjs(`${this.monthKey.value}-01`).add(delta, 'month').format(MONTH_FORMAT)
    if (this.mode.value === 'month') this.#onChange()
  }
}
