import { sql, type Transaction } from 'kysely'
import type { DB } from '../../db/schema.ts'
import type { NormalizedVisit } from '../../types.ts'
import { matchesHidden } from '../settings/hidden-patterns.ts'

// sqlite binds one parameter per value; keep batches well under the limit
const CHUNK = 500

// find each url, creating the missing ones. New urls get batch min/max times as
// a seed; applyDeltas() then folds in only the visits that were really inserted.
export async function resolveUrlIds(tx: Transaction<DB>, visits: NormalizedVisit[], urlIds: Map<string, number>): Promise<void> {
  // one pass over the batch: per-url seed (min/max time + latest title)
  const unique: string[] = []
  const seeds = new Map<string, {
    first: number
    last: number
    title: string | null
  }>()
  for (const visit of visits) {
    const seed = seeds.get(visit.url)
    if (seed === undefined) {
      unique.push(visit.url)
      seeds.set(visit.url, {
        first: visit.visitTime,
        last: visit.visitTime,
        title: visit.title
      })
      continue
    }
    if (visit.visitTime < seed.first) seed.first = visit.visitTime
    if (visit.visitTime >= seed.last) {
      seed.last = visit.visitTime
      seed.title = visit.title
    }
  }

  for (const chunk of chunks(unique)) {
    const rows = await tx
      .selectFrom('urls')
      .select(['id', 'url'])
      .where('url', 'in', chunk)
      .execute()
    for (const row of rows)
      urlIds.set(row.url, row.id)
  }

  const missing = unique.filter((url) => !urlIds.has(url))
  for (const chunk of chunks(missing)) {
    const values = chunk.map((url) => {
      const seed = seeds.get(url)!
      return {
        url,
        title: seed.title,
        first_visit_time: seed.first,
        last_visit_time: seed.last,
      }
    })
    await tx
      .insertInto('urls')
      .values(values)
      .onConflict((oc) => oc.column('url').doNothing())
      .execute()
    const created = await tx
      .selectFrom('urls')
      .select(['id', 'url'])
      .where('url', 'in', chunk)
      .execute()
    for (const row of created)
      urlIds.set(row.url, row.id)
  }
}

// flag every candidate url that matches the user's patterns
export async function flagHidden(
  tx: Transaction<DB>,
  urlIds: Map<string, number>,
  patterns: string[]
): Promise<void> {
  const hiddenIds = [...urlIds]
    .filter(([url]) => matchesHidden(url, patterns))
    .map(([, id]) => id)
  for (const chunk of chunks(hiddenIds))
    await tx
      .insertInto('hidden_urls')
      .values(chunk.map((url_id) => ({ url_id })))
      .onConflict((oc) => oc.column('url_id').doNothing())
      .execute()
}

export interface UrlDelta {
  url_id: number
  count: number
  typed: number
  first: number
  last: number
  title: string | null
}

// insert visits in chunks; UNIQUE(source_profile_id, source_visit_id) dedupes.
// RETURNING yields only the rows that were actually inserted, from which we
// fold the per-url aggregate deltas.
export async function insertVisits(
  tx: Transaction<DB>,
  sourceProfileId: number,
  offset: number,
  visits: NormalizedVisit[],
  urlIds: Map<string, number>,
): Promise<Map<number, UrlDelta>> {
  const bySourceId = new Map<number, NormalizedVisit>()
  for (const visit of visits)
    bySourceId.set(visit.sourceVisitId + offset, visit)

  const deltas = new Map<number, UrlDelta>()
  for (const chunk of chunks(visits)) {
    const inserted = await tx
      .insertInto('visits')
      .values(chunk.map((visit) => ({
        url_id: urlIds.get(visit.url)!,
        visit_time: visit.visitTime,
        transition: visit.transition,
        source_profile_id: sourceProfileId,
        source_visit_id: visit.sourceVisitId + offset,
      })))
      .onConflict((oc) => oc.columns(['source_profile_id', 'source_visit_id']).doNothing())
      .returning(['url_id', 'visit_time', 'transition', 'source_visit_id'])
      .execute()

    for (const row of inserted) {
      const delta = deltas.get(row.url_id) ?? {
        url_id: row.url_id,
        count: 0,
        typed: 0,
        first: row.visit_time,
        last: row.visit_time,
        title: null,
      }
      delta.count += 1
      if (row.transition === 'typed') delta.typed += 1
      if (row.visit_time < delta.first) delta.first = row.visit_time
      // latest visit wins the title (ties: later in the batch wins)
      if (row.visit_time >= delta.last) {
        delta.last = row.visit_time
        delta.title = bySourceId.get(row.source_visit_id)?.title ?? null
      }
      deltas.set(row.url_id, delta)
    }
  }
  return deltas
}

// fold every url's delta into its aggregates with one UPDATE per chunk
export async function applyDeltas(tx: Transaction<DB>, deltas: Map<number, UrlDelta>): Promise<void> {
  for (const chunk of chunks([...deltas.values()], 200)) {
    const values = chunk.map((delta) => sql`SELECT ${delta.url_id} AS id, ${delta.count} AS c, ${delta.typed} AS t, ${delta.first} AS f, ${delta.last} AS l, ${delta.title} AS title`)
    await sql`
      UPDATE urls SET
        visit_count = visit_count + d.c,
        typed_count = typed_count + d.t,
        first_visit_time = MIN(first_visit_time, d.f),
        last_visit_time = MAX(last_visit_time, d.l),
        title = CASE WHEN d.l >= urls.last_visit_time THEN COALESCE(d.title, urls.title) ELSE urls.title END
      FROM (${sql.join(values, sql` UNION ALL `)}) AS d
      WHERE urls.id = d.id
    `.execute(tx)
  }
}

function chunks<T>(items: readonly T[], size = CHUNK): T[][] {
  const out: T[][] = []
  for (let index = 0; index < items.length; index += size)
    out.push(items.slice(index, index + size))
  return out
}
