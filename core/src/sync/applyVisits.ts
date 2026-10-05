import type { DatabaseSync } from 'node:sqlite'
import type { EpochMs, Transition } from '../model.ts'
import { detectCleared, getWatermark, resetOffset, setWatermark } from './watermarks.ts'

// --- contract ---

export type SourceKind = 'chromium' | 'firefox' | 'safari' | 'takeout'

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
}

export interface ApplyVisitsOptions {
  full?: boolean
  idPolicy?: 'monotonic' | 'opaque'
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

// --- run ---

export function applyVisits(params: ApplyVisitsParams): ApplyVisitsResult {
  const { db, profile, visits, options } = params
  const now = options.now ?? Date.now()
  const sourceProfileId = ensureSourceProfile(db, profile)
  const watermark = getWatermark(db, sourceProfileId)
  const opaque = options.idPolicy === 'opaque'

  let maxSeen = 0
  for (const visit of visits)
    if (visit.sourceVisitId > maxSeen)
      maxSeen = visit.sourceVisitId

  const cleared = !opaque && detectCleared(watermark, maxSeen)
  const offset = cleared ? resetOffset(watermark) : watermark.sourceIdOffset
  const skipBelow = (opaque || options.full === true || cleared) ? -1 : watermark.lastSourceVisitId
  let pending = 0
  for (const visit of visits)
    if (visit.sourceVisitId > skipBelow)
      pending += 1

  const insertUrl = db.prepare(
    'INSERT OR IGNORE INTO urls (url, title, visit_count, typed_count, first_visit_time, last_visit_time) VALUES (?, ?, 0, 0, ?, ?)',
  )
  const urlIdOf = db.prepare('SELECT id FROM urls WHERE url = ?')
  const touchUrl = db.prepare(
    'UPDATE urls SET visit_count = visit_count + 1, typed_count = typed_count + ?, first_visit_time = MIN(first_visit_time, ?), last_visit_time = MAX(last_visit_time, ?), title = CASE WHEN ? >= last_visit_time THEN COALESCE(?, title) ELSE title END WHERE id = ?',
  )
  const insertVisit = db.prepare(
    'INSERT OR IGNORE INTO visits (url_id, visit_time, transition, source_profile_id, source_visit_id) VALUES (?, ?, ?, ?, ?)',
  )

  const urlIds = new Map<string, number>()
  const touched = new Set<number>()
  let insertedVisits = 0

  db.exec('BEGIN')
  try {
    for (const visit of visits) {
      if (visit.sourceVisitId <= skipBelow) continue
      let urlId = urlIds.get(visit.url)
      if (urlId === undefined) {
        const row = urlIdOf.get(visit.url) as { id: number } | undefined
        urlId = row === undefined ? undefined : Number(row.id)
      }
      if (urlId === undefined) {
        const created = insertUrl.run(visit.url, visit.title, visit.visitTime, visit.visitTime)
        urlId = Number(created.changes) === 1 ? Number(created.lastInsertRowid) : Number((urlIdOf.get(visit.url) as { id: number }).id)
      }
      urlIds.set(visit.url, urlId)
      const inserted = insertVisit.run(
        urlId,
        visit.visitTime,
        visit.transition,
        sourceProfileId,
        visit.sourceVisitId + offset,
      )
      if (Number(inserted.changes) === 0) continue
      insertedVisits += 1
      touched.add(urlId)
      touchUrl.run(
        visit.transition === 'TYPED' ? 1 : 0,
        visit.visitTime,
        visit.visitTime,
        visit.visitTime,
        visit.title,
        urlId,
      )
    }
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
  if (row === undefined) throw new Error(`failed to register source profile ${profile.kind}:${profile.profilePath}`)
  return Number(row.id)
}
