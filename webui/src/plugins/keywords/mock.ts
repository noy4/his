import {
  parseSearchQuery,
  type HistoryItem, type KeywordSearchParams, type KeywordStats, type SearchPage, type StatsParams,
} from '@his/core'
import { isoDay } from '@/lib/date'
import { MOCK_VISITS, byLastVisitDesc, inPeriod, paginate, sortByDay, visibleItems } from '@/app/api/mock/kit'

function keywordItems(): { item: HistoryItem; term: string }[] {
  return visibleItems().flatMap((item) => {
    const info = parseSearchQuery(item.url)
    return info === null ? [] : [{ item, term: info.term }]
  })
}

function mockKeywordSearch(params: KeywordSearchParams): SearchPage {
  const rows = collapseKeywordTerms(
    keywordItems().flatMap(({ item, term }) => {
      const it = inPeriod(item, params.month)
      return it === null ? [] : [{ item: it, term }]
    }),
  )
  return paginate(rows, params.cursor, params.limit)
}

// one HistoryItem per term; id/url/title/lastVisit come from the latest visit
function collapseKeywordTerms(rows: { item: HistoryItem; term: string }[]): HistoryItem[] {
  const byTerm = new Map<string, HistoryItem>()
  for (const { item, term } of rows) {
    const key = term.toLowerCase()
    const prev = byTerm.get(key)
    if (prev === undefined) {
      byTerm.set(key, item)
      continue
    }
    prev.visitCount += item.visitCount
    prev.typedCount += item.typedCount
    prev.firstVisit = Math.min(prev.firstVisit, item.firstVisit)
    if (item.lastVisit > prev.lastVisit) {
      prev.id = item.id
      prev.url = item.url
      prev.title = item.title
      prev.lastVisit = item.lastVisit
    }
  }
  return [...byTerm.values()].sort(byLastVisitDesc)
}

function mockKeywordStats(month?: string): KeywordStats {
  const terms = new Set<string>()
  let searches = 0
  let firstVisit = Number.POSITIVE_INFINITY
  let lastVisit = 0
  for (const { item, term } of keywordItems()) {
    const it = inPeriod(item, month)
    if (it === null) continue
    searches += it.visitCount
    terms.add(term.toLowerCase())
    firstVisit = Math.min(firstVisit, it.firstVisit)
    lastVisit = Math.max(lastVisit, it.lastVisit)
  }
  return {
    totals: {
      searches,
      keywords: terms.size,
      firstVisit: Number.isFinite(firstVisit) ? firstVisit : 0,
      lastVisit,
    },
    byDay: keywordByDay(month),
  }
}

function keywordByDay(month?: string): KeywordStats['byDay'] {
  const byDay = new Map<string, number>()
  for (const { item } of keywordItems()) {
    for (const visit of MOCK_VISITS.get(item.id) ?? []) {
      const day = isoDay(visit.visitTime)
      if (month !== undefined && day.slice(0, 7) !== month) continue
      byDay.set(day, (byDay.get(day) ?? 0) + 1)
    }
  }
  return sortByDay(byDay)
}

export const keywordsMock = {
  keywords: {
    async stats({ month }: StatsParams = {}): Promise<KeywordStats> {
      return mockKeywordStats(month)
    },
    async search(params: KeywordSearchParams): Promise<SearchPage> {
      return mockKeywordSearch(params)
    },
  },
}
