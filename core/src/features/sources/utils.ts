// `browser:profile` key for a source
export function sourceKey(source: { browser: string; profile: string }): string {
  return `${source.browser}:${source.profile}`
}
