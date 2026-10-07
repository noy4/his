import type { SnapshotTarget } from './snapshot.ts'
import { resolveChromium } from './sources/chromium.ts'
import { resolveFirefox } from './sources/firefox.ts'
import { resolveSafari } from './sources/safari.ts'
import { KNOWN_BROWSERS, kindOfBrowser } from './sources/source.ts'
import { resolveTakeout } from './sources/takeout.ts'

export function resolveTargets(home: string, targets: string[] | undefined): SnapshotTarget[] {
  if (targets === undefined)
    return discoverAllTargets(home)

  return targets.flatMap((target) => {
    const sep = target.indexOf(':')
    if (sep === -1)
      return discoverBrowser(home, target)
    const browser = target.slice(0, sep)
    const profile = target.slice(sep + 1)
    return discoverBrowser(home, browser, profile)
  })
}

export function discoverAllTargets(home: string): SnapshotTarget[] {
  return KNOWN_BROWSERS.flatMap((browser) => discoverBrowser(home, browser))
}

export function discoverBrowser(home: string, browser: string, profile?: string): SnapshotTarget[] {
  const kind = kindOfBrowser(browser)
  switch (kind) {
    case 'chromium': return resolveChromium(browser, profile)
    case 'firefox': return resolveFirefox(profile)
    case 'safari': return resolveSafari(profile)
    case 'takeout': return resolveTakeout(home, profile)
  }
}
