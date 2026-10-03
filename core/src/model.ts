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

export type EpochMs = number

export interface HistoryItem {
  id: number
  url: string
  title: string
  visitCount: number
  typedCount: number
  firstVisit: EpochMs
  lastVisit: EpochMs
  hiddenAt: EpochMs | null
}

export interface VisitItem {
  id: number
  urlId: number
  transition: Transition
  visitTime: EpochMs
}
