// https://developer.mozilla.org/en-US/docs/Mozilla/Add-ons/WebExtensions/API/history/TransitionType
export const TRANSITIONS = [
  'LINK',
  'TYPED',
  'AUTO_BOOKMARK',
  'AUTO_SUBFRAME',
  'MANUAL_SUBFRAME',
  'GENERATED',
  'AUTO_TOPLEVEL',
  'FORM_SUBMIT',
  'RELOAD',
  'KEYWORD',
  'KEYWORD_GENERATED',
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
