import {
  matchesYoutubeKind, mergeYoutubeRows, parseYoutubeUrl,
  type SearchPage, type StatsParams, type YoutubeSearchParams, type YoutubeStats,
} from '@his/core'
import { isoDay } from '@/lib/date'
import { MOCK_VISITS, byLastVisitDesc, inPeriod, paginate, visibleItems } from '@/app/api/mock/kit'

function mockYoutubeSearch(params: YoutubeSearchParams): SearchPage {
  const kind = params.kind ?? 'all'
  const rows = mergeYoutubeRows(
    visibleItems().flatMap((item) => {
      const info = parseYoutubeUrl(item.url)
      if (info === null) return []
      const it = inPeriod(item, params.month)
      return it === null ? [] : [{ item: it, urlInfo: info }]
    }),
  )
    .filter(({ urlInfo }) => matchesYoutubeKind(urlInfo, kind))
    .map(({ item }) => item)
    .sort(byLastVisitDesc)
  return paginate(rows, params.cursor, params.limit)
}

function mockYoutubeStats(month?: string): YoutubeStats {
  const videos = new Set<string>()
  const shorts = new Set<string>()
  const top = new Map<string, { id: string; shorts: boolean; title: string; url: string; visits: number }>()
  let visits = 0
  let firstVisit = Number.POSITIVE_INFINITY
  let lastVisit = 0
  for (const item of visibleItems()) {
    const info = parseYoutubeUrl(item.url)
    if (info === null) continue
    const it = inPeriod(item, month)
    if (it === null) continue
    visits += it.visitCount
    firstVisit = Math.min(firstVisit, it.firstVisit)
    lastVisit = Math.max(lastVisit, it.lastVisit)
    if (info.kind !== 'video' || info.id === undefined) continue
    const isShort = info.shorts === true
    if (isShort) shorts.add(info.id)
    else videos.add(info.id)
    const prev = top.get(info.id)
    if (prev === undefined) {
      top.set(info.id, { id: info.id, shorts: isShort, title: it.title ?? it.url, url: it.url, visits: it.visitCount })
    } else {
      prev.visits += it.visitCount
      prev.shorts ||= isShort
    }
  }
  return {
    totals: {
      visits,
      videos: videos.size,
      shorts: shorts.size,
      firstVisit: Number.isFinite(firstVisit) ? firstVisit : 0,
      lastVisit,
    },
    byDay: computeYoutubeByDay(month),
    topVideos: [...top.values()].sort((a, b) => b.visits - a.visits).slice(0, 5),
  }
}

function computeYoutubeByDay(month?: string): YoutubeStats['byDay'] {
  const map = new Map<string, YoutubeStats['byDay'][number]>()
  for (const item of visibleItems()) {
    const info = parseYoutubeUrl(item.url)
    if (info === null) continue
    const kind = info.kind !== 'video' ? 'other' : info.shorts === true ? 'shorts' : 'video'
    for (const visit of MOCK_VISITS.get(item.id) ?? []) {
      const day = isoDay(visit.visitTime)
      if (month !== undefined && day.slice(0, 7) !== month) continue
      const row = map.get(day) ?? { day, all: 0, video: 0, shorts: 0, other: 0 }
      row.all += 1
      row[kind] += 1
      map.set(day, row)
    }
  }
  return [...map.values()].sort((a, b) => a.day.localeCompare(b.day))
}

export const youtubeMock = {
  youtube: {
    async stats({ month }: StatsParams = {}): Promise<YoutubeStats> {
      return mockYoutubeStats(month)
    },
    async search(params: YoutubeSearchParams): Promise<SearchPage> {
      return mockYoutubeSearch(params)
    },
  },
}
