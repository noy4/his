import { CHROMIUM_BROWSERS } from './adapters/chromium.ts'
import type { Browser } from './types.ts'
import { FIREFOX_BROWSER } from './adapters/firefox.ts'
import { SAFARI_BROWSER } from './adapters/safari.ts'
import { TAKEOUT_BROWSER } from './adapters/takeout.ts'

// single source of truth for every browser the domain knows
export const BROWSERS: readonly Browser[] = [
  ...CHROMIUM_BROWSERS,
  FIREFOX_BROWSER,
  SAFARI_BROWSER,
  TAKEOUT_BROWSER,
]

const BY_NAME = new Map(BROWSERS.map((browser) => [browser.name, browser]))

export const KNOWN_BROWSERS: string[] = [...BY_NAME.keys()]

export function browserOf(name: string): Browser {
  const browser = BY_NAME.get(name)
  if (browser === undefined) throw new Error(`unknown browser: ${name}`)
  return browser
}
