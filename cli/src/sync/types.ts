import type { SourceKind } from '@his/core'
export const SYNC_KINDS: SourceKind[] = ['chromium', 'firefox', 'safari', 'takeout']

export function isSourceKind(value: string): value is SourceKind {
  return SYNC_KINDS.includes(value as SourceKind)
}

export interface SyncOptions {
  source?: string
  full?: boolean
}

export interface SyncHooks {
  onLog?(line: string): void
  onError?(line: string): void
}

export interface SyncSummary {
  attempted: number
  failures: number
  skipped: number
  insertedVisits: number
  touchedUrls: number
}
