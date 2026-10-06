import fs from 'node:fs'
import path from 'node:path'
import type { SourceKind } from '../model.ts'
import type { SnapshotTarget } from './snapshot.ts'
import { discoverChromiumProfiles } from './sources/chromium.ts'
import { discoverFirefoxProfiles } from './sources/firefox.ts'
import { discoverSafariProfiles } from './sources/safari.ts'
import { takeoutDir } from '../paths.ts'
import { takeoutProfileKey } from './sources/takeout.ts'

export const SYNC_KINDS: SourceKind[] = ['chromium', 'firefox', 'safari', 'takeout']

export function discoverAllTargets(home: string): SnapshotTarget[] {
  return SYNC_KINDS.flatMap((kind) => discoverForKind(kind, home))
}

function discoverForKind(kind: SourceKind, home: string): SnapshotTarget[] {
  switch (kind) {
    case 'chromium':
      return discoverChromiumProfiles()
    case 'firefox':
      return discoverFirefoxProfiles()
    case 'safari':
      return discoverSafariProfiles()
    case 'takeout':
      return takeoutTargets(home)
  }
}

function takeoutTargets(home: string): SnapshotTarget[] {
  const dir = takeoutDir(home)
  if (!fs.existsSync(dir)) return []
  return fs.readdirSync(dir)
    .filter((name) => name.endsWith('.json'))
    .sort()
    .map((name) => {
      const dbPath = path.join(dir, name)
      return {
        browser: 'takeout' as const,
        profile: takeoutProfileKey(dbPath),
        displayName: `Takeout (${name})`,
        dbPath,
      }
    })
}
