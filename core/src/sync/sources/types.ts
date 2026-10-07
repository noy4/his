import type { SourceKind } from '../../model.ts'
import type { IdMode, NativeVisit } from '../applyVisits.ts'
import type { SnapshotTarget } from '../snapshot.ts'

// parse engine, shared by every browser built on it; stateless
export interface Engine {
  readonly kind: SourceKind
  readonly idMode: IdMode
  /** profiles of one browser; profile token selects one, undefined = all */
  discover(browser: Browser, home: string, profile: string | undefined): SnapshotTarget[]
  /** read one staging snapshot file */
  parse(path: string): NativeVisit[]
}

// one browser: pure data pointing at its engine
export interface Browser {
  readonly slug: string
  readonly displayName: string
  readonly engine: Engine
  /** chromium: user dir under the platform's data root; no key = not on that platform */
  readonly userDirs?: Partial<Record<NodeJS.Platform, string>>
}
