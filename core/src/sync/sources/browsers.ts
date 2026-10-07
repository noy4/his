import { CHROMIUM_BROWSERS } from './chromium.ts'
import type { Browser } from './types.ts'
import { FIREFOX_BROWSER } from './firefox.ts'
import { SAFARI_BROWSER } from './safari.ts'
import { TAKEOUT_BROWSER } from './takeout.ts'

// single source of truth for every browser the domain knows
export const BROWSERS: readonly Browser[] = [
  ...CHROMIUM_BROWSERS,
  FIREFOX_BROWSER,
  SAFARI_BROWSER,
  TAKEOUT_BROWSER,
]

const BY_SLUG = new Map(BROWSERS.map((browser) => [browser.slug, browser]))

export const KNOWN_BROWSERS: string[] = [...BY_SLUG.keys()]

export function browserOf(slug: string): Browser {
  const browser = BY_SLUG.get(slug)
  if (browser === undefined) throw new Error(`unknown browser: ${slug}`)
  return browser
}
