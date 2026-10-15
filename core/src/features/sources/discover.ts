import type { SyncTarget } from './types.ts'
import { browserOf, KNOWN_BROWSERS } from './browsers.ts'

export function resolveTargets(home: string, targets: string[] | undefined): SyncTarget[] {
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

export function discoverAllTargets(home: string): SyncTarget[] {
  return KNOWN_BROWSERS.flatMap((browser) => discoverBrowser(home, browser))
}

export function discoverBrowser(home: string, name: string, profile?: string): SyncTarget[] {
  const browser = browserOf(name)
  return browser.engine.discover(browser, home, profile)
}
