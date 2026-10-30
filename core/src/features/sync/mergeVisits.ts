import type { IdMode, NormalizedVisit, SourceKind } from '../../types.ts'
import { getSettings } from '../settings/settings.ts'
import { getCheckpoint, setCheckpoint } from './checkpoints.ts'
import { planIngest } from './skip.ts'
import type { KyselyDb } from '../../db/db.ts'
import { applyDeltas, flagHidden, insertVisits, resolveUrlIds } from './writes.ts'

export interface SourceProfileRef {
  browser: string
  profile: string
  kind: SourceKind
  sourcePath: string
  idMode: IdMode
}

export interface MergeVisitsParams {
  db: KyselyDb
  profile: SourceProfileRef
  visits: NormalizedVisit[]
  rescan?: boolean
}

export interface MergeVisitsResult {
  sourceProfileId: number
  cleared: boolean
  insertedVisits: number
  touchedUrls: number
}

// merge one profile's visits into the archive
export async function mergeVisits(params: MergeVisitsParams): Promise<MergeVisitsResult> {
  const { db, profile, visits, rescan } = params
  const now = Date.now()
  const sourceProfileId = await ensureSourceProfile(db, profile)
  const checkpoint = await getCheckpoint(db, sourceProfileId)

  if (visits.length === 0)
    return {
      sourceProfileId,
      cleared: false,
      insertedVisits: 0,
      touchedUrls: 0,
    }

  const { cleared, sourceIdOffset, sourceMaxVisitId, candidates } = planIngest({
    visits,
    checkpoint,
    idMode: profile.idMode,
    rescan,
  })

  // hidden are applied at insert time
  const { hidden_patterns = [] } = await getSettings(db)

  const { insertedVisits, touchedUrls } = await db.transaction().execute(async (tx) => {
    const urlIds = new Map<string, number>()
    await resolveUrlIds(tx, candidates, urlIds)
    if (hidden_patterns.length > 0)
      await flagHidden(tx, urlIds, hidden_patterns)

    const deltas = await insertVisits(tx, sourceProfileId, sourceIdOffset, candidates, urlIds)
    const insertedVisits = [...deltas.values()].reduce((sum, delta) => sum + delta.count, 0)
    await applyDeltas(tx, deltas)

    await setCheckpoint(tx, sourceProfileId, {
      lastSourceVisitId: sourceMaxVisitId,
      sourceIdOffset,
      lastRunAt: now,
    })

    return {
      insertedVisits,
      touchedUrls: deltas.size,
    }
  })

  return {
    sourceProfileId,
    cleared,
    insertedVisits,
    touchedUrls,
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
      source_path: profile.sourcePath,
    })
    .onConflict((oc) => oc.columns(['browser', 'profile']).doUpdateSet({
      kind: profile.kind,
      source_path: profile.sourcePath,
    }))
    .returning('id')
    .executeTakeFirst()
  if (row === undefined)
    throw new Error(`failed to register source profile ${profile.browser}:${profile.profile}`)
  return row.id
}
