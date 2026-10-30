import type { HisApi } from '@/app/api'
import type { RpcCall } from '@/lib/rpc-transport'
import { signal } from '@preact/signals-react'
import { createApi } from '@/app/api'

export class AppModel {
  readonly api: HisApi
  readonly rpc: RpcCall
  readonly view = signal('dashboard')

  constructor(api = createApi()) {
    this.api = api
    this.rpc = api.rpc
  }

  setView(next: string): void {
    this.view.value = next
  }
}
