// browser slug → display name
const BROWSER_NAME_MAP: Record<string, string> = {
  chrome: 'Google Chrome',
  chromium: 'Chromium',
  edge: 'Microsoft Edge',
  brave: 'Brave',
  vivaldi: 'Vivaldi',
  arc: 'Arc',
  opera: 'Opera',
  'opera-gx': 'Opera GX',
  firefox: 'Firefox',
  safari: 'Safari',
  takeout: 'Takeout',
}

// 'brave' → 'Brave'
export function browserName(browser: string): string {
  return BROWSER_NAME_MAP[browser]
    ?? browser.charAt(0).toUpperCase() + browser.slice(1)
}
