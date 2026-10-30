import type { KyselyDb } from '@his/core/node'
import type { Handler } from '../rpc.ts'

export interface PluginContext {
  db: KyselyDb
}

export interface ServerPlugin {
  name: string
  handlers: (ctx: PluginContext) => Record<string, Handler>
}
