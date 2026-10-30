import { sql, type Transaction } from 'kysely'
import type { DB } from '../../db/schema.ts'
import type { NormalizedVisit } from '../../types.ts'
import { matchesHidden } from '../settings/hidden-patterns.ts'

const WRITE_CHUNK_SIZE = 500
const URL_UPDATE_CHUNK_SIZE = 200

export async function ensureUrlIds(tx: Transaction<DB>, visits: NormalizedVisit[], urlIds: Map<string, number>): Promise<void> {
  const uniqueUrls: string[] = []
  const seeds = new Map<string, {
    firstVisitTime: number
    lastVisitTime: number
    title: string | null
  }>()
  for (const visit of visits) {
    const seed = seeds.get(visit.url)
    if (seed === undefined) {
      uniqueUrls.push(visit.url)
      seeds.set(visit.url, {
        firstVisitTime: visit.visitTime,
        lastVisitTime: visit.visitTime,
        title: visit.title
      })
      continue
    }
    if (visit.visitTime < seed.firstVisitTime)
      seed.firstVisitTime = visit.visitTime
    if (visit.visitTime >= seed.lastVisitTime) {
      seed.lastVisitTime = visit.visitTime
      seed.title = visit.title
    }
  }

  for (const chunk of chunked(uniqueUrls)) {
    const rows = await tx
      .selectFrom('urls')
      .select(['id', 'url'])
      .where('url', 'in', chunk)
      .execute()
    for (const row of rows)
      urlIds.set(row.url, row.id)
  }

  const missing = uniqueUrls.filter((url) => !urlIds.has(url))
  for (const chunk of chunked(missing)) {
    const values = chunk.map((url) => {
      const seed = seeds.get(url)!
      return {
        url,
        title: seed.title,
        first_visit_time: seed.firstVisitTime,
        last_visit_time: seed.lastVisitTime,
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

// mark every url that matches the user's patterns
export async function markHidden(
  tx: Transaction<DB>,
  urlIds: Map<string, number>,
  patterns: string[]
): Promise<void> {
  const hiddenIds = [...urlIds]
    .filter(([url]) => matchesHidden(url, patterns))
    .map(([, id]) => id)
  for (const chunk of chunked(hiddenIds))
    await tx
      .insertInto('hidden_urls')
      .values(chunk.map((urlId) => ({ url_id: urlId })))
      .onConflict((oc) => oc.column('url_id').doNothing())
      .execute()
}

export interface UrlDelta {
  urlId: number
  visitCount: number
  typedCount: number
  firstVisitTime: number
  lastVisitTime: number
  title: string | null
}

// insert visits in chunks
export async function insertVisits(
  tx: Transaction<DB>,
  sourceProfileId: number,
  sourceIdOffset: number,
  visits: NormalizedVisit[],
  urlIds: Map<string, number>,
): Promise<Map<number, UrlDelta>> {
  const bySourceId = new Map<number, NormalizedVisit>()
  for (const visit of visits)
    bySourceId.set(visit.sourceVisitId + sourceIdOffset, visit)

  const deltas = new Map<number, UrlDelta>()
  for (const chunk of chunked(visits)) {
    const inserted = await tx
      .insertInto('visits')
      .values(chunk.map((visit) => ({
        url_id: urlIds.get(visit.url)!,
        visit_time: visit.visitTime,
        transition: visit.transition,
        source_profile_id: sourceProfileId,
        source_visit_id: visit.sourceVisitId + sourceIdOffset,
      })))
      .onConflict((oc) => oc.columns(['source_profile_id', 'source_visit_id']).doNothing())
      .returning(['url_id', 'visit_time', 'transition', 'source_visit_id'])
      .execute()

    for (const row of inserted) {
      const delta = deltas.get(row.url_id) ?? {
        urlId: row.url_id,
        visitCount: 0,
        typedCount: 0,
        firstVisitTime: row.visit_time,
        lastVisitTime: row.visit_time,
        title: null,
      }
      delta.visitCount += 1
      if (row.transition === 'typed') delta.typedCount += 1
      if (row.visit_time < delta.firstVisitTime)
        delta.firstVisitTime = row.visit_time
      // latest visit wins the title (ties: later in the batch wins)
      if (row.visit_time >= delta.lastVisitTime) {
        delta.lastVisitTime = row.visit_time
        delta.title = bySourceId.get(row.source_visit_id)?.title ?? null
      }
      deltas.set(row.url_id, delta)
    }
  }
  return deltas
}

// fold every url's delta into its aggregates with one UPDATE per chunk
export async function applyUrlDeltas(tx: Transaction<DB>, deltas: Map<number, UrlDelta>): Promise<void> {
  for (const chunk of chunked([...deltas.values()], URL_UPDATE_CHUNK_SIZE)) {
    const values = chunk.map((delta) => sql`SELECT ${delta.urlId} AS id, ${delta.visitCount} AS c, ${delta.typedCount} AS t, ${delta.firstVisitTime} AS f, ${delta.lastVisitTime} AS l, ${delta.title} AS title`)
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

function chunked<T>(items: readonly T[], size = WRITE_CHUNK_SIZE): T[][] {
  const out: T[][] = []
  for (let index = 0; index < items.length; index += size)
    out.push(items.slice(index, index + size))
  return out
}
