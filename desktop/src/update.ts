// The app is unsigned, so there is no auto-update (electron-updater requires
// signing) — the tray shows a "New version available" item that opens the
// release page instead.
const REPO = 'noy4/his'

export type Release = { version: string; url: string }

type ApiRelease = { tag_name?: unknown; html_url?: unknown; draft?: boolean; prerelease?: boolean }

export async function latestRelease(): Promise<Release | null> {
  try {
    const res = await fetch(`https://api.github.com/repos/${REPO}/releases?per_page=20`, {
      headers: { 'User-Agent': 'his-desktop', Accept: 'application/vnd.github+json' },
      signal: AbortSignal.timeout(10_000),
    })
    if (!res.ok) return null
    const body: unknown = await res.json()
    const list = Array.isArray(body) ? (body as ApiRelease[]) : []
    const release = list.find((r) => !r.draft && !r.prerelease)
    if (!release) return null
    return { version: String(release.tag_name).replace(/^v/, ''), url: String(release.html_url) }
  } catch {
    return null
  }
}

export function isNewer(release: string, current: string): boolean {
  const a = release.split('.').map(Number)
  const b = current.split('.').map(Number)
  for (let i = 0; i < Math.max(a.length, b.length); i++) {
    if ((a[i] ?? 0) > (b[i] ?? 0)) return true
    if ((a[i] ?? 0) < (b[i] ?? 0)) return false
  }
  return false
}
