import type { SourceKind } from '../../model.ts'
import type { IdMode, NativeVisit } from '../applyVisits.ts'

// one discovered profile to sync
export interface SyncTarget {
  // browser slug
  browser: string
  profile: string
  dbPath: string
}

// parse engine, shared by every browser built on it; stateless
export interface Engine {
  readonly kind: SourceKind
  readonly idMode: IdMode
  /** profiles of one browser; profile token selects one, undefined = all */
  discover(browser: Browser, home: string, profile: string | undefined): SyncTarget[]
  /** read one staging snapshot file */
  parse(path: string): NativeVisit[]
}

// one browser: pure data pointing at its engine
export interface Browser {
  readonly name: string
  readonly label: string
  readonly engine: Engine
  /** chromium: user dir under the platform's data root; no key = not on that platform */
  readonly userDirs?: Partial<Record<NodeJS.Platform, string>>
}
