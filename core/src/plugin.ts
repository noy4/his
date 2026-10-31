import type { KyselyDb } from './db/db.ts'

// Node-side plugin contract

export interface PluginContext {
  db: KyselyDb
}

export type RpcHandler = (params: Record<string, any>) => unknown | Promise<unknown>

export interface ServerPlugin {
  name: string
  handlers: (ctx: PluginContext) => Record<string, RpcHandler>
}
