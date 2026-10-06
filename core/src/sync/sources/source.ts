import type { IdMode, NativeVisit } from '../applyVisits.ts'
import type { SourceKind } from '../../model.ts'
import type { SnapshotResult, SnapshotTarget } from '../snapshot.ts'
import { ChromiumSource } from './chromium.ts'
import { FirefoxSource } from './firefox.ts'
import { SafariSource } from './safari.ts'
import { TakeoutSource } from './takeout.ts'

// instance contract, one profile
export interface ProfileSource {
  readonly browser: string
  readonly profile: string
  readonly kind: SourceKind
  readonly idMode: IdMode
  readonly displayName: string | null
  readonly profilePath: string

  /** log label, e.g. "chromium · Brave (Default)" */
  readonly label: string

  /** stage a consistent copy of the source db */
  snapshot(): SnapshotResult

  /** read one staging snapshot file */
  parse(path: string): NativeVisit[]
}

// kind to concrete class
export const SOURCES: Record<SourceKind, new (target: SnapshotTarget, home: string) => ProfileSource> = {
  chromium: ChromiumSource,
  firefox: FirefoxSource,
  safari: SafariSource,
  takeout: TakeoutSource,
}

// slug to engine; keep in sync with CHROMIUM_APPS
const KIND_OF_BROWSER: Record<string, SourceKind> = {
  chrome: 'chromium',
  chromium: 'chromium',
  edge: 'chromium',
  brave: 'chromium',
  vivaldi: 'chromium',
  arc: 'chromium',
  opera: 'chromium',
  'opera-gx': 'chromium',
  firefox: 'firefox',
  safari: 'safari',
  takeout: 'takeout',
}

// parse engine for a browser slug
export function kindOfBrowser(browser: string): SourceKind {
  const kind = KIND_OF_BROWSER[browser]
  if (kind === undefined) throw new Error(`unknown browser: ${browser}`)
  return kind
}

// dispatch by browser
export function createSource(target: SnapshotTarget, home: string): ProfileSource {
  const Class = SOURCES[kindOfBrowser(target.browser)]
  return new Class(target, home)
}
