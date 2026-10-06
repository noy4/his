import type { IdMode, NativeVisit, SourceKind } from '../applyVisits.ts'
import type { SnapshotResult, SnapshotTarget } from '../snapshot.ts'
import { ChromiumSource } from './chromium.ts'
import { FirefoxSource } from './firefox.ts'
import { SafariSource } from './safari.ts'
import { TakeoutSource } from './takeout.ts'

// instance contract, one profile
export interface ProfileSource {
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

// dispatch by kind
export function createSource(target: SnapshotTarget, home: string): ProfileSource {
  const Class = SOURCES[target.source as SourceKind]
  if (Class === undefined) throw new Error(`unknown source: ${target.source}`)
  return new Class(target, home)
}
