import type { HisApi, HistoryItem, ItemDetail, SearchPage, SearchParams, VisitItem } from '../api'
import { MOCK_ITEMS, MOCK_VISITS } from './data'

const DEFAULT_LIMIT = 50

function byLastVisitDesc(a: HistoryItem, b: HistoryItem): number {
  return b.lastVisit - a.lastVisit || b.id - a.id
}

function encodeCursor(item: HistoryItem): string {
  return btoa(`v1.${item.lastVisit}.${item.id}`)
}

function decodeCursor(cursor: string): { lastVisit: number; id: number } | null {
  try {
    const m = /^v1\.(\d+)\.(\d+)$/.exec(atob(cursor))
    if (!m) return null
    return { lastVisit: Number(m[1]), id: Number(m[2]) }
  } catch {
    return null
  }
}

function findVisible(params: SearchParams): HistoryItem[] {
  const q = params.query?.trim().toLowerCase() ?? ''
  const from = params.from ?? -Infinity
  const to = params.to ?? Infinity
  const rows = MOCK_ITEMS.filter(
    (it) =>
      it.hiddenAt === null &&
      it.lastVisit >= from &&
      it.lastVisit <= to &&
      (q === '' || it.title.toLowerCase().includes(q) || it.url.toLowerCase().includes(q)),
  )
  rows.sort(byLastVisitDesc)
  return rows
}

export const mockApi: HisApi = {
  async search(params: SearchParams): Promise<SearchPage> {
    const rows = findVisible(params)
    const cursor = params.cursor ? decodeCursor(params.cursor) : null
    const keyed = cursor
      ? rows.filter((it) => it.lastVisit < cursor.lastVisit || (it.lastVisit === cursor.lastVisit && it.id < cursor.id))
      : rows
    const limit = params.limit ?? DEFAULT_LIMIT
    const page = keyed.slice(0, limit)
    const nextCursor = keyed.length > limit && page.length > 0 ? encodeCursor(page[page.length - 1]) : null
    return { items: page, nextCursor }
  },

  async getVisits(urlId: number, limit?: number): Promise<VisitItem[]> {
    const visits = MOCK_VISITS.get(urlId) ?? []
    return limit === undefined ? visits : visits.slice(0, limit)
  },

  async getItem(id: number): Promise<ItemDetail | null> {
    const item = MOCK_ITEMS.find((it) => it.id === id)
    if (!item) return null
    return { item, visits: MOCK_VISITS.get(id) ?? [] }
  },

  async deleteUrl(url: string): Promise<void> {
    const item = MOCK_ITEMS.find((it) => it.url === url)
    if (item) item.hiddenAt = Date.now()
  },

  async restoreUrl(url: string): Promise<void> {
    const item = MOCK_ITEMS.find((it) => it.url === url)
    if (item) item.hiddenAt = null
  },
}
