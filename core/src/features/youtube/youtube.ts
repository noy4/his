import { matchesYoutubeKind, parseYoutubeUrl, youtubeItemKey, type YoutubeUrlInfo } from './parse.ts'
import { getYoutubeRows, getYoutubeVisitDays } from './youtubeRows.ts'
import type { YoutubeDayItem, YoutubeDayKind, YoutubeStats, YoutubeSearchParams, YoutubeVisitKind } from './types.ts'
import type { StatsParams } from '../history/types.ts'
import type { EpochMs, HistoryItem } from '../../types.ts'
import { clampLimit, decodeCursor, paginate } from '../../db/query/paging.ts'
import type { Page } from '../../db/query/paging.ts'
import { topBy } from '../../util/top.ts'
import type { KyselyDb } from '../../db/db.ts'

// YouTube Insights read API: youtubeStats (aggregate) + youtubeSearch (paged list).

const TOP = 5
const DAY_TOP = 3

/** YouTube totals + top videos (month-scoped when given). */
export async function youtubeStats(db: KyselyDb, { month }: StatsParams = {}): Promise<YoutubeStats> {
  const videoIds = new Set<string>()
  const shortIds = new Set<string>()
  const top = new Map<string, {
    value: YoutubeStats['topVideos'][number]
    last: EpochMs
  }>()
  const kindCounts: Record<YoutubeVisitKind, number> = {
    all: 0,
    video: 0,
    shorts: 0,
    channel: 0,
    playlist: 0,
    search: 0,
    other: 0,
  }
  let visits = 0
  let firstVisit = 0
  let lastVisit = 0

  // accumulate totals and top videos per URL
  for (const { item, urlInfo } of await getYoutubeRows(db, month)) {
    visits += item.visitCount
    firstVisit = (firstVisit === 0 || item.firstVisit < firstVisit)
      ? item.firstVisit
      : firstVisit
    lastVisit = Math.max(lastVisit, item.lastVisit)
    kindCounts.all += 1
    kindCounts[visitKindOf(urlInfo)] += 1

    // only videos (watch / embed / youtu.be / shorts) become top entries
    if (urlInfo.kind !== 'video' || urlInfo.id === undefined) continue
    const isShort = urlInfo.shorts !== undefined
    if (isShort) shortIds.add(urlInfo.id)
    else videoIds.add(urlInfo.id)

    const prev = top.get(urlInfo.id)
    if (prev === undefined) {
      top.set(urlInfo.id, {
        value: {
          id: urlInfo.id,
          shorts: isShort,
          title: item.title,
          url: item.url,
          visits: item.visitCount,
        },
        last: item.lastVisit,
      })
    } else {
      prev.value.visits += item.visitCount
      prev.value.shorts ||= isShort
      // latest visit wins for title / url
      if (item.lastVisit > prev.last) {
        prev.value.title = item.title
        prev.value.url = item.url
        prev.last = item.lastVisit
      }
    }
  }

  return {
    totals: {
      visits,
      videos: videoIds.size,
      shorts: shortIds.size,
      firstVisit,
      lastVisit,
    },
    kindCounts,
    byDay: await youtubeByDay(db, month),
    byDayTop: await youtubeDayTop(db, month),
    topVideos: topBy([...top.values()].map((e) => e.value), {
      limit: TOP,
      score: (v) => v.visits,
      key: (v) => v.id,
    }),
  }
}

// display kind for a charted day: a video (watch/embed/youtu.be), a short, or other
function dayKindOf(urlInfo: YoutubeUrlInfo): YoutubeDayKind {
  return urlInfo.kind !== 'video' ? 'other' : urlInfo.shorts ? 'shorts' : 'video'
}

// the exact filter bucket a URL belongs to (every row lands in one of these)
function visitKindOf(urlInfo: YoutubeUrlInfo): Exclude<YoutubeVisitKind, 'all'> {
  if (urlInfo.kind === 'video') return urlInfo.shorts ? 'shorts' : 'video'
  if (urlInfo.kind !== undefined) return urlInfo.kind
  return urlInfo.search ? 'search' : 'other'
}

// daily visit counts split by video kind; 'all' is the day total
async function youtubeByDay(db: KyselyDb, month?: string): Promise<YoutubeStats['byDay']> {
  const byDay = new Map<string, YoutubeStats['byDay'][number]>()
  for (const row of await getYoutubeVisitDays(db, month)) {
    const urlInfo = parseYoutubeUrl(row.url)
    if (urlInfo === null) continue
    const bucket = byDay.get(row.day) ?? { day: row.day, all: 0, video: 0, shorts: 0, other: 0 }
    bucket.all += row.visits
    bucket[dayKindOf(urlInfo)] += row.visits
    byDay.set(row.day, bucket)
  }
  return [...byDay.values()].sort((a, b) => a.day.localeCompare(b.day))
}

// per-day top items (most recently visited first) per kind, for chart tooltips
async function youtubeDayTop(db: KyselyDb, month?: string): Promise<YoutubeStats['byDayTop']> {
  const days = new Map<string, Record<YoutubeDayKind, Map<string, YoutubeDayItem>>>()
  for (const row of await getYoutubeVisitDays(db, month)) {
    const urlInfo = parseYoutubeUrl(row.url)
    if (urlInfo === null) continue
    const kind = visitKindOf(urlInfo)
    const byKind = days.get(row.day) ?? { video: new Map(), shorts: new Map(), other: new Map() }
    const bucket = byKind[dayKindOf(urlInfo)]
    const key = youtubeItemKey(urlInfo, row.url)
    const item = bucket.get(key) ?? {
      key,
      kind,
      id: urlInfo.id,
      title: '',
      url: row.url,
      visits: 0,
      lastVisit: 0,
    }
    item.visits += row.visits
    if (row.lastVisit >= item.lastVisit) {
      item.title = row.title ?? ''
      item.url = row.url
    }
    item.lastVisit = Math.max(item.lastVisit, row.lastVisit)
    bucket.set(key, item)
    days.set(row.day, byKind)
  }
  return [...days.entries()]
    .sort(([a], [b]) => a.localeCompare(b))
    .map(([day, byKind]) => ({
      day,
      video: topRecent([...byKind.video.values()]),
      shorts: topRecent([...byKind.shorts.values()]),
      other: topRecent([...byKind.other.values()]),
    }))
}

// most recently visited first; ties by visits then key
function topRecent(items: YoutubeDayItem[]): YoutubeDayItem[] {
  return items
    .sort((a, b) => b.lastVisit - a.lastVisit || b.visits - a.visits || a.key.localeCompare(b.key))
    .slice(0, DAY_TOP)
}

/** Paged YouTube history items with a kind filter (month optional). */
export async function youtubeSearch(db: KyselyDb, params: YoutubeSearchParams = {}): Promise<Page<HistoryItem>> {
  const kind = params.kind ?? 'all'
  const limit = clampLimit(params.limit)
  const cursor = params.cursor === undefined
    ? null
    : decodeCursor(params.cursor)

  const rows = (await getYoutubeRows(db, params.month))
    .filter(({ urlInfo }) => matchesYoutubeKind(urlInfo, kind))
    .map(({ item }) => item)
  const rowsAfterCursor = cursor === null
    ? rows
    : rows.filter((it) =>
      it.lastVisit < cursor[0]
      || (it.lastVisit === cursor[0] && it.id < cursor[1])
    )
  rowsAfterCursor.sort((a, b) => b.lastVisit - a.lastVisit || b.id - a.id)
  return paginate(rowsAfterCursor, limit, (item) => [item.lastVisit, item.id])
}
