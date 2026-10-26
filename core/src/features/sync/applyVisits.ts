import { sql, type Transaction } from 'kysely'
import type { DB } from '../../db/schema.ts'
import type { EpochMs, IdMode, NormalizedVisit, SourceKind, SyncCheckpoint } from '../../types.ts'
import { getSettings } from '../settings/settings.ts'
import { matchesHidden } from '../settings/hidden-patterns.ts'
import { detectCleared, getCheckpoint, resetOffset, setCheckpoint } from './checkpoints.ts'
import type { KyselyDb } from '../../db/db.ts'

export interface SourceProfileRef {
  browser: string
  profile: string
  kind: SourceKind
  profilePath: string
  idMode: IdMode
}

export interface ApplyVisitsOptions {
  full?: boolean
  now?: EpochMs
}

export interface ApplyVisitsResult {
  sourceProfileId: number
  seenVisits: number
  processedVisits: number
  insertedVisits: number
  touchedUrls: number
  cleared: boolean
  lastSourceVisitId: number
  sourceIdOffset: number
  lastRunAt: EpochMs
}

export interface ApplyVisitsParams {
  db: KyselyDb
  profile: SourceProfileRef
  visits: NormalizedVisit[]
  options: ApplyVisitsOptions
}

// sqlite binds one parameter per value; keep batches well under the limit
const CHUNK = 500

// --- applyVisits ---

// merge one profile's visits into the archive. All writes are set-based
// (chunked multi-row inserts + one aggregate UPDATE per batch) so a large
// first import does not compile one query per visit.
export async function applyVisits(params: ApplyVisitsParams): Promise<ApplyVisitsResult> {
  const { db, profile, visits, options } = params
  const now = options.now ?? Date.now()
  const sourceProfileId = await ensureSourceProfile(db, profile) // find-or-create the profile row
  const checkpoint = await getCheckpoint(db, sourceProfileId) // last ingested source id

  // empty batch: don't touch the checkpoint, a real clear shows on the next batch
  if (visits.length === 0)
    return {
      sourceProfileId,
      seenVisits: 0,
      processedVisits: 0,
      insertedVisits: 0,
      touchedUrls: 0,
      cleared: false,
      lastSourceVisitId: checkpoint.lastSourceVisitId,
      sourceIdOffset: checkpoint.sourceIdOffset,
      lastRunAt: now,
    }

  // pre-pass: batch max id and the count past the checkpoint
  let maxSeen = 0
  let aboveCheckpoint = 0
  for (const visit of visits) {
    const id = visit.sourceVisitId
    if (id > maxSeen)
      maxSeen = id
    if (id > checkpoint.lastSourceVisitId)
      aboveCheckpoint += 1
  }

  // id space shrank vs the checkpoint: history was cleared, realign
  const { cleared, offset, skipBelow, processAll } = computeSkip({
    checkpoint,
    maxSeen,
    idMode: profile.idMode,
    full: options.full,
  })
  const pending = processAll ? visits.length : aboveCheckpoint
  const candidates = visits.filter((visit) => visit.sourceVisitId > skipBelow)

  // new URLs are flagged hidden at insert time, so sync needs no full recompute
  const { hidden_patterns = [] } = await getSettings(db)

  let insertedVisits = 0
  let touchedUrls = 0

  // all-or-nothing: the checkpoint advances with the commit
  await db.transaction().execute(async (tx) => {
    const urlIds = new Map<string, number>()
    await resolveUrlIds(tx, candidates, urlIds)
    if (hidden_patterns.length > 0)
      await flagHidden(tx, urlIds, hidden_patterns)

    const deltas = await insertVisits(tx, sourceProfileId, offset, candidates, urlIds)
    insertedVisits = [...deltas.values()].reduce((sum, delta) => sum + delta.count, 0)
    touchedUrls = deltas.size
    await applyDeltas(tx, deltas)

    await setCheckpoint(tx, sourceProfileId, {
      lastSourceVisitId: maxSeen,
      sourceIdOffset: offset,
      lastRunAt: now,
    })
  })

  return {
    sourceProfileId,
    seenVisits: visits.length,
    processedVisits: pending,
    insertedVisits,
    touchedUrls,
    cleared,
    lastSourceVisitId: maxSeen,
    sourceIdOffset: offset,
    lastRunAt: now,
  }
}

// --- helpers ---

// find each url, creating the missing ones. New urls get batch min/max times as
// a seed; applyDeltas() then folds in only the visits that were really inserted.
async function resolveUrlIds(tx: Transaction<DB>, visits: NormalizedVisit[], urlIds: Map<string, number>): Promise<void> {
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
async function flagHidden(
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

interface UrlDelta {
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
async function insertVisits(
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
async function applyDeltas(tx: Transaction<DB>, deltas: Map<number, UrlDelta>): Promise<void> {
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

// flow policy for one batch, decided before touching any rows
export interface SkipState {
  cleared: boolean
  processAll: boolean
  offset: number
  skipBelow: number
}

export interface ComputeSkipParams {
  checkpoint: SyncCheckpoint
  maxSeen: number
  idMode: IdMode
  full?: boolean
}

// decide cleared / offset / skipBelow from the checkpoint and this batch's ids
export function computeSkip({ checkpoint, maxSeen, idMode, full }: ComputeSkipParams): SkipState {
  const hashIds = idMode === 'hash' // hash ids carry no order, skip checkpoint logic
  const cleared = !hashIds && detectCleared(checkpoint, maxSeen)
  const processAll = hashIds || full || cleared
  return {
    cleared,
    processAll,
    offset: cleared ? resetOffset(checkpoint) : checkpoint.sourceIdOffset,
    skipBelow: processAll ? -1 : checkpoint.lastSourceVisitId,
  }
}

// upsert the profile row and return its id
export async function ensureSourceProfile(db: KyselyDb, profile: SourceProfileRef): Promise<number> {
  const row = await db
    .insertInto('source_profiles')
    .values({
      browser: profile.browser,
      profile: profile.profile,
      kind: profile.kind,
      profile_path: profile.profilePath,
    })
    .onConflict((oc) => oc.columns(['browser', 'profile']).doUpdateSet({
      kind: profile.kind,
      profile_path: profile.profilePath,
    }))
    .returning('id')
    .executeTakeFirst()
  if (row === undefined)
    throw new Error(`failed to register source profile ${profile.browser}:${profile.profile}`)
  return row.id
}
