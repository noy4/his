// https://developer.mozilla.org/en-US/docs/Mozilla/Add-ons/WebExtensions/API/history/TransitionType
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
