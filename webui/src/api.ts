// mirrors @his/core model.ts — https://developer.mozilla.org/en-US/docs/Mozilla/Add-ons/WebExtensions/API/history/TransitionType
export const TRANSITIONS = [
  'link',
  'typed',
  'auto_bookmark',
  'auto_subframe',
  'manual_subframe',
  'generated',
  'auto_toplevel',
  'form_submit',
  'reload',
  'keyword',
  'keyword_generated',
] as const

export type Transition = (typeof TRANSITIONS)[number]

export interface HistoryItem {
  id: number
  url: string
  title: string
  visitCount: number
  typedCount: number
  firstVisit: number
  lastVisit: number
  hiddenAt: number | null
}

export interface VisitItem {
  id: number
  urlId: number
  transition: Transition
  visitTime: number
}

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
export interface HisEvents {}

export interface HisApi {
  search(params: SearchParams): Promise<SearchPage>
  getVisits(urlId: number, limit?: number): Promise<VisitItem[]>
  getItem(id: number): Promise<ItemDetail | null>
  deleteUrl(url: string): Promise<void>
  restoreUrl(url: string): Promise<void>
  stats(): Promise<Stats>
  on<K extends keyof HisEvents & string>(event: K, handler: HisEvents[K]): () => void
}
