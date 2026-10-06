import type { SnapshotTarget } from './snapshot.ts'
import { discoverChromiumBrowser } from './sources/chromium.ts'
import { discoverFirefoxProfiles } from './sources/firefox.ts'
import { discoverSafariProfiles } from './sources/safari.ts'
import { KNOWN_BROWSERS, kindOfBrowser } from './sources/source.ts'
import { takeoutTargets } from './sources/takeout.ts'

// discover one browser's profiles on this machine
export function discoverBrowser(home: string, browser: string): SnapshotTarget[] {
  switch (kindOfBrowser(browser)) {
    case 'chromium':
      return discoverChromiumBrowser(browser)
    case 'firefox':
      return discoverFirefoxProfiles()
    case 'safari':
      return discoverSafariProfiles()
    case 'takeout':
      return takeoutTargets(home)
  }
}

// every known browser, deterministic order
export function discoverAllTargets(home: string): SnapshotTarget[] {
  return KNOWN_BROWSERS
    .flatMap((browser) => discoverBrowser(home, browser))
    .sort((x, y) => x.browser.localeCompare(y.browser) || x.profile.localeCompare(y.profile))
}

// discovery narrowed to the browsers named in targets ("browser" or
// "browser:profile" tokens); unknown tokens silently match nothing
export function discoverTargets(home: string, targets: string[] | undefined): SnapshotTarget[] {
  if (targets === undefined) return discoverAllTargets(home)
  const browsers = [...new Set(targets
    .map((token) => token.slice(0, token.indexOf(':') === -1 ? token.length : token.indexOf(':')))
    .filter((browser) => KNOWN_BROWSERS.includes(browser)))]
  return browsers
    .flatMap((browser) => discoverBrowser(home, browser))
    .sort((x, y) => x.browser.localeCompare(y.browser) || x.profile.localeCompare(y.profile))
}

// targets limit: "browser:profile" exact (profile normalized the way discovery
// slugified its dirs), bare "browser" = all its profiles
const DIR_PATTERN = /[^A-Za-z0-9._-]+/g

export function resolveTargets(home: string, targets: string[] | undefined): SnapshotTarget[] {
  if (targets === undefined) return discoverAllTargets(home)
  return discoverTargets(home, targets).filter((target) => {
    const key = `${target.browser}:${target.profile}`
    return targets.some((token) => {
      const at = token.indexOf(':')
      if (at === -1) return key.startsWith(`${token}:`)
      const profile = token.slice(at + 1).replace(DIR_PATTERN, '-')
      return token.slice(0, at) === target.browser && target.profile === profile
    })
  })
}
