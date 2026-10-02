export const TRANSITIONS = [
  'LINK',
  'TYPED',
  'AUTO_BOOKMARK',
  'AUTO_SUBFRAME',
  'MANUAL_SUBFRAME',
  'FORM_SUBMIT',
  'GENERATED',
  'RELOAD',
  'START_PAGE',
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

export interface HisApi {
  search(params: SearchParams): Promise<SearchPage>
  getVisits(urlId: number, limit?: number): Promise<VisitItem[]>
  getItem(id: number): Promise<ItemDetail | null>
  deleteUrl(url: string): Promise<void>
  restoreUrl(url: string): Promise<void>
}
