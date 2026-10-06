import fs from 'node:fs'
import path from 'node:path'
import {
  discoverChromiumProfiles,
  discoverFirefoxProfiles,
  discoverSafariProfiles,
  takeoutProfileKey,
} from '@his/core'
import type { SnapshotTarget, SourceKind } from '@his/core'
import { takeoutDir } from '../home.ts'

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
