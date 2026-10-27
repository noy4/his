// youtube.com / youtu.be URL → video / channel / playlist

import type { YoutubeUrlKind, YoutubeVisitKind } from './types.ts'

export interface YoutubeUrlInfo {
  kind?: YoutubeUrlKind // undefined = other (home, search, feed, …)
  id?: string // video id / playlist id / channel handle or id
  shorts?: true
}

const HOSTS = new Set([
  'youtube.com',
  'www.youtube.com',
  'm.youtube.com',
])

// 'https://www.youtube.com/watch?v=dQw4w9WgXcQ&t=1s' → { kind: 'video', id: 'dQw4w9WgXcQ' }
// non-YouTube host → null
// a YouTube page without an entity → {} (kind undefined)
export function parseYoutubeUrl(url: string): YoutubeUrlInfo | null {
  let u: URL
  try {
    u = new URL(url)
  } catch {
    return null
  }
  const host = u.hostname.toLowerCase()

  // youtu.be
  if (host === 'youtu.be') {
    const id = u.pathname.split('/').filter(Boolean)[0]
    return id === undefined ? {} : { kind: 'video', id }
  }
  if (!HOSTS.has(host)) return null

  const [seg0, seg1] = u.pathname.split('/').filter(Boolean)
  if (seg0 === undefined) return {}

  if (seg0 === 'watch') {
    const v = u.searchParams.get('v')
    return v === null ? {} : { kind: 'video', id: v }
  }
  if (seg0 === 'shorts' && seg1 !== undefined)
    return { kind: 'video', id: seg1, shorts: true }

  if (seg0 === 'embed' && seg1 !== undefined)
    return { kind: 'video', id: seg1 }

  if (seg0 === 'playlist') {
    const list = u.searchParams.get('list')
    return list === null ? {} : { kind: 'playlist', id: list }
  }

  if (seg0.startsWith('@')) return { kind: 'channel', id: seg0 }
  if ((seg0 === 'channel' || seg0 === 'c' || seg0 === 'user') && seg1 !== undefined)
    return { kind: 'channel', id: seg1 }

  return {}
}

export function matchesYoutubeKind(urlInfo: YoutubeUrlInfo, kind: YoutubeVisitKind): boolean {
  if (kind === 'all') return true
  if (kind === 'other') return urlInfo.kind === undefined
  if (kind === 'shorts')
    return urlInfo.kind === 'video' && urlInfo.shorts === true
  if (kind === 'video')
    return urlInfo.kind === 'video' && urlInfo.shorts !== true
  return urlInfo.kind === kind
}

// 'Title - YouTube' → 'Title'
export function parseYoutubeTitle(title: string, urlInfo: YoutubeUrlInfo): { name: string } {
  const t = title.replace(/\s*-\s*YouTube\s*$/i, '').trim()
  return { name: t || (urlInfo.id ?? urlInfo.kind ?? title) }
}
