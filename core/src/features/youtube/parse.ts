// youtube.com / youtu.be URL → video / channel / playlist

import type { YoutubeUrlKind, YoutubeVisitKind } from './types.ts'
import type { HistoryItem } from '../../types.ts'

export interface YoutubeUrlInfo {
  kind?: YoutubeUrlKind // undefined = other (home, feed, …)
  id?: string // video id / playlist id / channel handle or id
  shorts?: true
  search?: true // a search results page
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

  if (seg0 === 'results') return { search: true }

  return {}
}

export function matchesYoutubeKind(urlInfo: YoutubeUrlInfo, kind: YoutubeVisitKind): boolean {
  return kind === 'all' || visitKindOf(urlInfo) === kind
}

export function visitKindOf(urlInfo: YoutubeUrlInfo): Exclude<YoutubeVisitKind, 'all'> {
  if (urlInfo.kind === 'video')
    return urlInfo.shorts !== undefined ? 'shorts' : 'video'
  if (urlInfo.kind !== undefined) return urlInfo.kind
  return urlInfo.search !== undefined ? 'search' : 'other'
}

// 'Title - YouTube' → 'Title'
export function parseYoutubeTitle(title: string, urlInfo: YoutubeUrlInfo): { name: string } {
  const t = title.replace(/\s*-\s*YouTube\s*$/i, '').trim()
  return { name: t || (urlInfo.id ?? urlInfo.kind ?? title) }
}

// params injected by extensions/clients that never identify a page
const NOISE_PARAMS = new Set(['themeRefresh'])

// entity key: URL variants (?themeRefresh=1 …) → same key; entity-less pages → normalized url
export function youtubeItemKey(urlInfo: YoutubeUrlInfo, url: string): string {
  return urlInfo.kind !== undefined && urlInfo.id !== undefined
    ? `${urlInfo.kind}:${urlInfo.id}`
    : `url:${normalizeYoutubeUrl(url)}`
}

// drop noise params, hash, and trailing slashes so they don't split a page
function normalizeYoutubeUrl(url: string): string {
  let u: URL
  try {
    u = new URL(url)
  } catch {
    return url
  }
  for (const p of NOISE_PARAMS) u.searchParams.delete(p)
  const search = u.searchParams.toString()
  const path = u.pathname.replace(/\/+$/, '')
  return `${u.origin}${path}${search === '' ? '' : `?${search}`}`
}

export interface YoutubeRowLike<T extends VisitLike = HistoryItem> {
  item: T
  urlInfo: YoutubeUrlInfo
}

interface VisitLike {
  id: number
  url: string
  title: string
  visitCount: number
  typedCount: number
  firstVisit: number
  lastVisit: number
}

// collapse same-entity URL variants into one row; newest wins url/title, counts summed
export function mergeYoutubeRows<T extends VisitLike>(rows: YoutubeRowLike<T>[]): YoutubeRowLike<T>[] {
  const merged = new Map<string, YoutubeRowLike<T>>()
  for (const row of rows) {
    const key = youtubeItemKey(row.urlInfo, row.item.url)
    const prev = merged.get(key)
    if (prev === undefined) {
      merged.set(key, { item: { ...row.item }, urlInfo: { ...row.urlInfo } })
      continue
    }
    const a = prev.item
    const b = row.item
    const newer = b.lastVisit > a.lastVisit || (b.lastVisit === a.lastVisit && b.id > a.id) ? b : a
    prev.item = {
      ...newer,
      visitCount: a.visitCount + b.visitCount,
      typedCount: a.typedCount + b.typedCount,
      firstVisit: Math.min(a.firstVisit, b.firstVisit),
      lastVisit: Math.max(a.lastVisit, b.lastVisit),
    }
    if (row.urlInfo.shorts)
      prev.urlInfo = { ...prev.urlInfo, shorts: true }
  }
  return [...merged.values()]
}
