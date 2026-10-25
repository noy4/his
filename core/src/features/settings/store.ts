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

export async function readSettingsJson(db: KyselyDb): Promise<Map<string, unknown>> {
  const values = new Map<string, unknown>()
  const rows = await db
    .selectFrom('settings')
    .select(['key', 'value'])
    .execute()
  for (const row of rows) {
    try {
      values.set(row.key, JSON.parse(row.value))
    } catch {
      // skip broken values
    }
  }
  return values
}

export async function writeSettingJson(db: KyselyDb, key: string, value: unknown): Promise<void> {
  const serialized = JSON.stringify(value)
  await db
    .insertInto('settings')
    .values({ key, value: serialized })
    .onConflict((oc) => oc.column('key').doUpdateSet({ value: serialized }))
    .execute()
}
