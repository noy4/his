import type { DatabaseSync } from 'node:sqlite'
import type { EpochMs } from '../model.ts'

// --- contract ---

// Soft delete on urls.hidden_at — reads filter `hidden_at IS NULL`.
export function deleteUrl(db: DatabaseSync, url: string, now?: EpochMs): boolean {
  const result = db
    .prepare('UPDATE urls SET hidden_at = ? WHERE url = ? AND hidden_at IS NULL')
    .run(now ?? Date.now(), url)
  return Number(result.changes) > 0
}

export function restoreUrl(db: DatabaseSync, url: string): boolean {
  const result = db
    .prepare('UPDATE urls SET hidden_at = NULL WHERE url = ? AND hidden_at IS NOT NULL')
    .run(url)
  return Number(result.changes) > 0
}
