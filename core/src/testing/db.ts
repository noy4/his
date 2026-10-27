import type { KyselyDb } from '../db/db.ts'
import type { EpochMs } from '../types.ts'

export const sourceProfile = {
  id: 1,
  browser: 'chrome',
  profile: 'Default',
  kind: 'chromium',
  source_path: '/x',
}

let nextVisitId = 1

/** Inserts one URL plus a 'link' visit at each time; returns the URL id. */
export async function seedUrl(
  db: KyselyDb,
  { id, url, title, times }: { id?: number; url: string; title: string; times: readonly EpochMs[] },
): Promise<number> {
  const { id: urlId } = await db
    .insertInto('urls')
    .values({
      id,
      url,
      title,
      first_visit_time: Math.min(...times),
      last_visit_time: Math.max(...times),
      visit_count: times.length,
    })
    .returning('id')
    .executeTakeFirstOrThrow()
  await db
    .insertInto('visits')
    .values(times.map((time) => ({
      url_id: urlId,
      visit_time: time,
      transition: 'link',
      source_profile_id: sourceProfile.id,
      source_visit_id: nextVisitId++,
    })))
    .execute()
  return urlId
}
