// https://developer.mozilla.org/en-US/docs/Mozilla/Add-ons/WebExtensions/API/history/TransitionType
export const TRANSITIONS = [
  'link',
  'typed',
  'auto_bookmark',
  'auto_subframe',
  'manual_subframe',
  'generated',
  'auto_toplevel',
  'form_submit',
  'reload',
  'keyword',
  'keyword_generated',
] as const

export type Transition = (typeof TRANSITIONS)[number]

export type EpochMs = number

export interface HistoryItem {
  id: number
  url: string
  title: string
  visitCount: number
  typedCount: number
  firstVisit: EpochMs
  lastVisit: EpochMs
}

export interface VisitItem {
  id: number
  urlId: number
  transition: Transition
  visitTime: EpochMs
}

export type HistoryVisit = VisitItem & {
  url: string
  title: string
  /** Cumulative URL visits, independent of the selected visit range. */
  visitCount: number
}

export type SourceKind = 'chromium' | 'firefox' | 'safari' | 'takeout'

// id semantics: rowid is comparable, hash is not
export type IdMode = 'rowid' | 'hash'

// one visit parsed from a browser source
export interface NormalizedVisit {
  sourceVisitId: number
  url: string
  title: string | null
  visitTime: EpochMs
  transition: Transition
}

export interface Watermark {
  sourceProfileId: number
  lastSourceVisitId: number
  sourceIdOffset: number
  lastRunAt: EpochMs | null
}

export interface RegisteredSource {
  id: number
  browser: string
  profile: string
  kind: SourceKind
  profilePath: string
  watermark: Watermark
  /** listing aggregates over the profile's visits (sources.list) */
  visits: number
  lastVisit: EpochMs | null
  /** source changed since the last sync; null when not checked (sources.list check) */
  pending: boolean | null
}

export type SourceEntry = RegisteredSourceEntry | UnregisteredSourceEntry

export type RegisteredSourceEntry = RegisteredSource & {
  registered: true
}

export type UnregisteredSourceEntry = {
  browser: string
  profile: string
  registered: false
}

// one sync execution — returned by runSync / sync.run RPC
export interface SyncSummary {
  attempted: number
  failures: number
  skipped: number
  insertedVisits: number
  touchedUrls: number
  /** one line per failed target ("<browser> · <profile>: <message>") */
  errors: string[]
}

// how to run a sync — CLI flags, sync.run RPC params, runner invocations
export interface SyncOptions {
  /** limit targets: "browser" (all its profiles) or "browser:profile" (exact) */
  targets?: string[]
  full?: boolean
}

// the runner's record of the most recent sync execution — sync.status RPC
export interface SyncLastRun {
  startedAt: EpochMs
  finishedAt: EpochMs
  ok: boolean
  error: string | null
  attempted: number
  failures: number
  insertedVisits: number
  touchedUrls: number
}
