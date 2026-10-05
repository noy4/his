import type { HistoryItem, Transition, VisitItem } from '@his/core/model'

export { TRANSITIONS } from '@his/core/model'
export type { HistoryItem, Transition, VisitItem }

export interface ItemDetail {
  item: HistoryItem
  visits: VisitItem[]
}

export interface SearchParams {
  query?: string
  from?: number
  to?: number
  cursor?: string
  limit?: number
}

export interface SearchPage {
  items: HistoryItem[]
  nextCursor: string | null
}

export interface StatTotals {
  items: number
  visits: number
  domains: number
  firstVisit: number
  lastVisit: number
}

export interface Stats {
  totals: StatTotals
  byHour: { hour: number; visits: number }[]
  byDow: { dow: number; visits: number }[]
  topDomains: { domain: string; visits: number }[]
  busiestDays: { day: string; visits: number }[]
}

// notifications — sync.progress is on hold (see SPEC); db.changed pending
// open-ended so new server events can arrive before the map lists them
export interface HisEvents {
  [event: string]: (...args: any[]) => void
}

export interface HisApi {
  search(params: SearchParams): Promise<SearchPage>
  getVisits(urlId: number, limit?: number): Promise<VisitItem[]>
  getItem(id: number): Promise<ItemDetail | null>
  deleteUrl(url: string): Promise<void>
  restoreUrl(url: string): Promise<void>
  stats(): Promise<Stats>
  on<K extends keyof HisEvents & string>(event: K, handler: HisEvents[K]): () => void
}
