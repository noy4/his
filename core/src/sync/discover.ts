import type { SnapshotTarget } from './snapshot.ts'
import { resolveChromium } from './sources/chromium.ts'
import { resolveFirefox } from './sources/firefox.ts'
import { resolveSafari } from './sources/safari.ts'
import { KNOWN_BROWSERS, kindOfBrowser } from './sources/source.ts'
import { resolveTakeout } from './sources/takeout.ts'

export function resolveTargets(home: string, targets: string[] | undefined): SnapshotTarget[] {
  if (targets === undefined) return discoverAllTargets(home)

  const browsers = [...new Set(targets
    .map((token) => token.slice(0, token.indexOf(':') === -1 ? token.length : token.indexOf(':')))
    .filter((browser) => KNOWN_BROWSERS.includes(browser)))]
  const seen = new Map<string, SnapshotTarget>()
  const add = (found: SnapshotTarget[]) => found.forEach((target) => seen.set(`${target.browser}:${target.profile}`, target))
  for (const browser of browsers) {
    let bare = false
    const profiles: string[] = []
    for (const token of targets) {
      const at = token.indexOf(':')
      if (at === -1) bare ||= token === browser
      else if (token.slice(0, at) === browser) profiles.push(token.slice(at + 1))
    }
    if (bare) add(discoverBrowser(home, browser))
    else profiles.forEach((profile) => add(discoverBrowser(home, browser, profile)))
  }
  return [...seen.values()].sort((x, y) => x.browser.localeCompare(y.browser) || x.profile.localeCompare(y.profile))
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
