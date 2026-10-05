import type { DatabaseSync, StatementSync } from 'node:sqlite'
import type { EpochMs, Transition } from '../model.ts'
import { detectCleared, getWatermark, resetOffset, setWatermark } from './watermarks.ts'
import type { Watermark } from './watermarks.ts'

export type SourceKind = 'chromium' | 'firefox' | 'safari' | 'takeout'

// what a source's visit ids are — decides whether watermark logic may compare them
// rowid: live browser dbs number visits with ordered rowids
// hash: takeout synthesizes ids as content hashes, so magnitudes mean nothing
export type IdMode = 'rowid' | 'hash'

export const ID_MODES: Record<SourceKind, IdMode> = {
  chromium: 'rowid',
  firefox: 'rowid',
  safari: 'rowid',
  takeout: 'hash',
}

// one visit as parsed from a browser source
export interface NativeVisit {
  sourceVisitId: number
  url: string
  title: string | null
  visitTime: EpochMs
  transition: Transition
}

export interface SourceProfileRef {
  kind: SourceKind
  displayName: string | null
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
  db: DatabaseSync
  profile: SourceProfileRef
  visits: NativeVisit[]
  options: ApplyVisitsOptions
}

// --- applyVisits ---

// merge one profile's visits into the archive
export function applyVisits(params: ApplyVisitsParams): ApplyVisitsResult {
  const { db, profile, visits, options } = params
  const now = options.now ?? Date.now()
  const sourceProfileId = ensureSourceProfile(db, profile) // find-or-create the profile row
  const watermark = getWatermark(db, sourceProfileId) // last ingested source id

  // empty batch — don't touch the watermark; a real clear is detected on the next non-empty batch
  // (with maxSeen = 0, detectCleared would falsely fire and reset the offset)
  if (visits.length === 0)
    return {
      sourceProfileId,
      seenVisits: 0,
      processedVisits: 0,
      insertedVisits: 0,
      touchedUrls: 0,
      cleared: false,
      lastSourceVisitId: watermark.lastSourceVisitId,
      sourceIdOffset: watermark.sourceIdOffset,
      lastRunAt: now,
    }

  // one pre-pass: highest source id in this batch, plus how many are past the ingested watermark
  let maxSeen = 0
  let aboveWatermark = 0
  for (const visit of visits) {
    const id = visit.sourceVisitId
    if (id > maxSeen)
      maxSeen = id
    if (id > watermark.lastSourceVisitId)
      aboveWatermark += 1
  }

  // ids shrank vs the watermark → browser history was cleared → realign
  const { cleared, offset, skipBelow, processAll } = computeSkip({
    watermark,
    maxSeen,
    idMode: profile.idMode,
    full: options.full === true,
  })
  const pending = processAll ? visits.length : aboveWatermark

  // sql
  const stmts = prepareApplyStatements(db)

  const urlIds = new Map<string, number>()
  const touched = new Set<number>()
  let insertedVisits = 0

  // all-or-nothing
  db.exec('BEGIN')
  try {
    for (const visit of visits) {
      // skip if visitId is below the threshold
      if (visit.sourceVisitId <= skipBelow) continue

      // find or create the url row
      const urlId = resolveUrlId(stmts, urlIds, visit)

      // insert visits
      const inserted = stmts.insertVisit.run(
        urlId,
        visit.visitTime,
        visit.transition,
        sourceProfileId,
        visit.sourceVisitId + offset,
      )

      // skip if not inserted
      if (Number(inserted.changes) === 0) continue
      insertedVisits += 1
      touched.add(urlId)
      stmts.touchUrl.run(
        visit.transition === 'TYPED' ? 1 : 0,
        visit.visitTime,
        visit.visitTime,
        visit.visitTime,
        visit.title,
        urlId,
      )
    }
    // the watermark advances with the commit
    setWatermark(db, sourceProfileId, {
      lastSourceVisitId: maxSeen,
      sourceIdOffset: offset,
      lastRunAt: now,
    })
    db.exec('COMMIT')
  } catch (error) {
    db.exec('ROLLBACK')
    throw error
  }

  return {
    sourceProfileId,
    seenVisits: visits.length,
    processedVisits: pending,
    insertedVisits,
    touchedUrls: touched.size,
    cleared,
    lastSourceVisitId: maxSeen,
    sourceIdOffset: offset,
    lastRunAt: now,
  }
}

// --- helpers ---

// flow policy for one batch, decided before touching any rows
export interface SkipState {
  cleared: boolean
  processAll: boolean
  offset: number
  skipBelow: number
}

export interface ComputeSkipParams {
  watermark: Watermark
  maxSeen: number
  idMode: IdMode
  full: boolean
}

// decide cleared / offset / skipBelow from the watermark and this batch's ids
export function computeSkip({ watermark, maxSeen, idMode, full }: ComputeSkipParams): SkipState {
  const hashIds = idMode === 'hash' // hash ids carry no order — bypass watermark logic
  const cleared = !hashIds && detectCleared(watermark, maxSeen)
  const processAll = hashIds || full || cleared
  return {
    cleared,
    processAll,
    offset: cleared ? resetOffset(watermark) : watermark.sourceIdOffset,
    skipBelow: processAll ? -1 : watermark.lastSourceVisitId,
  }
}

// prepared sql for one apply run
export interface ApplyStatements {
  insertUrl: StatementSync
  urlIdOf: StatementSync
  touchUrl: StatementSync
  insertVisit: StatementSync
}

export function prepareApplyStatements(db: DatabaseSync): ApplyStatements {
  return {
    insertUrl: db.prepare(
      'INSERT OR IGNORE INTO urls (url, title, visit_count, typed_count, first_visit_time, last_visit_time) VALUES (?, ?, 0, 0, ?, ?)',
    ),
    urlIdOf: db.prepare('SELECT id FROM urls WHERE url = ?'),
    touchUrl: db.prepare(
      'UPDATE urls SET visit_count = visit_count + 1, typed_count = typed_count + ?, first_visit_time = MIN(first_visit_time, ?), last_visit_time = MAX(last_visit_time, ?), title = CASE WHEN ? >= last_visit_time THEN COALESCE(?, title) ELSE title END WHERE id = ?',
    ),
    insertVisit: db.prepare(
      'INSERT OR IGNORE INTO visits (url_id, visit_time, transition, source_profile_id, source_visit_id) VALUES (?, ?, ?, ?, ?)',
    ),
  }
}

// find or create the url row for the visit, remembering resolved ids for the batch
export function resolveUrlId(stmts: ApplyStatements, urlIds: Map<string, number>, visit: NativeVisit): number {
  const cached = urlIds.get(visit.url)
  if (cached !== undefined)
    return cached

  const existing = stmts.urlIdOf.get(visit.url) as { id: number } | undefined
  if (existing !== undefined) {
    const id = Number(existing.id)
    urlIds.set(visit.url, id)
    return id
  }

  const created = stmts.insertUrl.run(visit.url, visit.title, visit.visitTime, visit.visitTime)
  const id = Number(created.changes) === 1
    ? Number(created.lastInsertRowid)
    : Number((stmts.urlIdOf.get(visit.url) as { id: number }).id)
  urlIds.set(visit.url, id)
  return id
}

export function ensureSourceProfile(db: DatabaseSync, profile: SourceProfileRef): number {
  db.prepare('INSERT OR IGNORE INTO source_profiles (kind, display_name, profile_path) VALUES (?, ?, ?)').run(
    profile.kind,
    profile.displayName,
    profile.profilePath,
  )
  const row = db.prepare('SELECT id FROM source_profiles WHERE kind = ? AND profile_path = ?').get(
    profile.kind,
    profile.profilePath,
  ) as { id: number } | undefined
  if (row === undefined)
    throw new Error(`failed to register source profile ${profile.kind}:${profile.profilePath}`)
  return Number(row.id)
}
