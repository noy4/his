import type { KyselyDb } from '../../db/db.ts'

// parsed JSON value for a settings key; undefined when missing or broken
export async function readSettingJson(db: KyselyDb, key: string): Promise<unknown> {
  const row = await db
    .selectFrom('settings')
    .select('value')
    .where('key', '=', key)
    .executeTakeFirst()
  if (row === undefined) return undefined
  try {
    return JSON.parse(row.value)
  } catch {
    return undefined
  }
}

export async function writeSettingJson(db: KyselyDb, key: string, value: unknown): Promise<void> {
  const serialized = JSON.stringify(value)
  await db
    .insertInto('settings')
    .values({ key, value: serialized })
    .onConflict((oc) => oc.column('key').doUpdateSet({ value: serialized }))
    .execute()
}
