import { effect, signal } from '@preact/signals-react'

export interface SentinelModelParams {
  onLoad: () => void
  ready: () => boolean
}

/**
 * SentinelModel handles infinite scroll by observing when an element comes into view.
 */
export class SentinelModel {
  readonly #el = signal<Element | null>(null)
  readonly #onLoad: () => void
  readonly #ready: () => boolean

  constructor({ onLoad, ready }: SentinelModelParams) {
    this.#onLoad = onLoad
    this.#ready = ready
  }

  // pass as the element's ref
  attach = (el: Element | null): void => {
    this.#el.value = el
  }

  subscribe(): () => void {
    return effect(() => {
      const el = this.#el.value
      if (el === null || !this.#ready()) return
      const observer = new IntersectionObserver(
        (entries) => {
          if (entries.some((entry) => entry.isIntersecting)) this.#onLoad()
        },
        { rootMargin: '240px 0px' },
      )
      observer.observe(el)
      return () => observer.disconnect()
    })
  }
}
