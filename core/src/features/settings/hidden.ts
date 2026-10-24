import type { KyselyDb } from '../../db/db.ts'
import { cleanPatterns, matchesHidden } from './hidden-patterns.ts'
import { readSettingJson, writeSettingJson } from './store.ts'

const KEY = 'hidden_patterns'

export async function getHiddenPatterns(db: KyselyDb): Promise<string[]> {
  return cleanPatterns(await readSettingJson(db, KEY))
}

export async function setHiddenPatterns(db: KyselyDb, input: unknown): Promise<string[]> {
  const patterns = cleanPatterns(input)
  await writeSettingJson(db, KEY, patterns)
  await recomputeHidden(db, patterns)
  return patterns
}

export async function countHidden(db: KyselyDb): Promise<number> {
  const row = await db
    .selectFrom('hidden_urls')
    .select((eb) => eb.fn.countAll().as('count'))
    .executeTakeFirstOrThrow()
  return Number(row.count)
}

// recompute hidden_urls for every URL; only changed rows are written
export async function recomputeHidden(db: KyselyDb, patterns?: string[]): Promise<number> {
  const resolved = patterns ?? await getHiddenPatterns(db)
  const urls = await db
    .selectFrom('urls')
    .select(['id', 'url'])
    .execute()
  const matched = new Set<number>()
  for (const row of urls) {
    if (matchesHidden(row.url, resolved))
      matched.add(row.id)
  }
  const hiddenRows = await db
    .selectFrom('hidden_urls')
    .select('url_id')
    .execute()
  const current = new Set(hiddenRows.map((row) => row.url_id))

  let changed = 0
  await db.transaction().execute(async (tx) => {
    const toAdd = [...matched].filter((id) => !current.has(id))
    const toRemove = [...current].filter((id) => !matched.has(id))
    if (toAdd.length > 0)
      await tx
        .insertInto('hidden_urls')
        .values(toAdd.map((url_id) => ({ url_id })))
        .onConflict((oc) => oc.column('url_id').doNothing())
        .execute()
    if (toRemove.length > 0)
      await tx
        .deleteFrom('hidden_urls')
        .where('url_id', 'in', toRemove)
        .execute()
    changed = toAdd.length + toRemove.length
  })
  return changed
}
