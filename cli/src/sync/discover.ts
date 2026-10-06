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

export interface TargetFilter {
  browser?: string
  profile?: string
}

export function discoverTargets(kind: SourceKind, home: string, filter: TargetFilter = {}): SnapshotTarget[] {
  return discoverForKind(kind, home).filter((target) => targetMatches(target, filter))
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

// browser/profile as surfaced by the profile key:
// '<browser>-<dir>' for chromium/firefox/takeout (chromium carries the app slug, e.g. brave),
// bare 'default' for safari
function selector(target: SnapshotTarget): { browser: string, profile: string } {
  const prefix = `${target.source}-`
  if (target.profile.startsWith(prefix))
    return { browser: target.source, profile: target.profile.slice(prefix.length) }
  const cut = target.profile.indexOf('-')
  if (cut === -1)
    return { browser: target.source, profile: target.profile }
  return { browser: target.profile.slice(0, cut), profile: target.profile.slice(cut + 1) }
}

// normalize the filter the same way discovery slugified its dirs
const DIR_PATTERN = /[^A-Za-z0-9._-]+/g

function targetMatches(target: SnapshotTarget, filter: TargetFilter): boolean {
  const sel = selector(target)
  if (filter.browser !== undefined && sel.browser !== filter.browser)
    return false
  if (filter.profile !== undefined && sel.profile !== filter.profile.replace(DIR_PATTERN, '-'))
    return false
  return true
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
        source: 'takeout' as const,
        profile: takeoutProfileKey(dbPath),
        displayName: `Takeout (${name})`,
        dbPath,
      }
    })
}
