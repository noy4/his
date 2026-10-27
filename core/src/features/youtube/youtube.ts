import { matchesYoutubeKind, parseYoutubeUrl } from './parse.ts'
import { getYoutubeRows, getYoutubeVisitDays } from './youtubeRows.ts'
import type { YoutubeStats, YoutubeSearchFilter } from './types.ts'
import type { StatsParams } from '../history/types.ts'
import type { EpochMs, HistoryItem } from '../../types.ts'
import { clampLimit, decodeCursor, paginate } from '../../db/query/paging.ts'
import type { Page } from '../../db/query/paging.ts'
import { topBy } from '../../util/top.ts'
import type { KyselyDb } from '../../db/db.ts'

// YouTube Insights read API: youtubeStats (aggregate) + youtubeSearch (paged list).

const TOP = 5

/** YouTube totals + top videos (month-scoped when given). */
export async function youtubeStats(db: KyselyDb, { month }: StatsParams = {}): Promise<YoutubeStats> {
  const videoIds = new Set<string>()
  const shortIds = new Set<string>()
  const top = new Map<string, {
    value: YoutubeStats['topVideos'][number]
    last: EpochMs
  }>()
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

    // only videos (watch / embed / youtu.be / shorts) become top entries
    if (urlInfo.kind !== 'video' || urlInfo.id === undefined) continue
    const isShort = urlInfo.shorts === true
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
    byDay: await youtubeByDay(db, month),
    topVideos: topBy([...top.values()].map((e) => e.value), {
      limit: TOP,
      score: (v) => v.visits,
      key: (v) => v.id,
    }),
  }
}

// daily visit counts split by video kind; 'all' is the day total
async function youtubeByDay(db: KyselyDb, month?: string): Promise<YoutubeStats['byDay']> {
  const byDay = new Map<string, YoutubeStats['byDay'][number]>()
  for (const row of await getYoutubeVisitDays(db, month)) {
    const urlInfo = parseYoutubeUrl(row.url)
    if (urlInfo === null) continue
    const kind = urlInfo.kind !== 'video'
      ? 'other'
      : urlInfo.shorts === true
        ? 'shorts'
        : 'video'
    const bucket = byDay.get(row.day) ?? { day: row.day, all: 0, video: 0, shorts: 0, other: 0 }
    bucket.all += row.visits
    bucket[kind] += row.visits
    byDay.set(row.day, bucket)
  }
  return [...byDay.values()].sort((a, b) => a.day.localeCompare(b.day))
}

/** Paged YouTube history items with a kind filter (month optional). */
export async function youtubeSearch(db: KyselyDb, filter: YoutubeSearchFilter = {}): Promise<Page<HistoryItem>> {
  const kind = filter.kind ?? 'all'
  const limit = clampLimit(filter.limit)
  const cursor = filter.cursor === undefined
    ? null
    : decodeCursor(filter.cursor)

  const rows = (await getYoutubeRows(db, filter.month))
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
