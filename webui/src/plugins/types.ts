import type { IconComponent } from '@/components/icons'
import type { RpcCall } from '@/lib/rpc-transport'
import type { ReactNode } from 'react'

export interface ViewContext {
  rpc: RpcCall
}

// mock RPC namespaces
export type PluginMock = Record<string, Record<string, (params?: any) => Promise<unknown>>>

export interface ViewPlugin {
  name: string
  label: string
  icon: IconComponent
  View: (props: { app: ViewContext }) => ReactNode
  mock?: PluginMock
}
