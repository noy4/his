import { signal } from '@preact/signals-react'

export class AppModel {
  view = signal('timeline')
  query = signal('')

  setView(next: string): void {
    this.view.value = next
  }

  setQuery(next: string): void {
    this.query.value = next
  }
}
