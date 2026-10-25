import type { KyselyDb } from '../../db/db.ts'

export interface SettingDef<T> {
  /** side effects after the value is written */
  readonly afterWrite?: (db: KyselyDb, value: T) => Promise<void>
}

export type SettingValue<D> = D extends SettingDef<infer T> ? T : never
