import type { EpochMs, IdMode, NormalizedVisit, SourceKind } from '../../types.ts'
import { getSettings } from '../settings/settings.ts'
import { getCheckpoint, setCheckpoint } from './checkpoints.ts'
import { computeSkip } from './skip.ts'
import type { KyselyDb } from '../../db/db.ts'
import { applyDeltas, flagHidden, insertVisits, resolveUrlIds } from './writes.ts'

export interface SourceProfileRef {
  browser: string
  profile: string
  kind: SourceKind
  profilePath: string
  idMode: IdMode
}

export interface ApplyVisitsOptions {
  rescan?: boolean
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
    rescan: options.rescan,
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
