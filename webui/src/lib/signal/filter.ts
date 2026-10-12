import { effect, signal } from '@preact/signals-react'

const SEARCH_DEBOUNCE_MS = 300

export class FilterModel {
  readonly input = signal('')
  readonly query = signal('')
  readonly from = signal<number | null>(null)
  readonly to = signal<number | null>(null)
  #debounce: ReturnType<typeof setTimeout> | undefined
  #key: string | null = null

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

  subscribe(onChange: () => void): () => void {
    return effect(() => {
      const key = JSON.stringify([
        this.query.value,
        this.from.value,
        this.to.value,
      ])
      if (key === this.#key) return
      this.#key = key
      onChange()
    })
  }
}
