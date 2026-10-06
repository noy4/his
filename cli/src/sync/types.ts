export interface SyncOptions {
  browser?: string
  profile?: string
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
