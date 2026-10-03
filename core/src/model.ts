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

export interface NormalizedTransition {
  transition: Transition
  sourceTransition: string | null
}

export function normalizeTransition<K extends string | number>(
  native: K,
  map: ReadonlyMap<K, Transition>,
): NormalizedTransition {
  const hit = map.get(native)
  return hit === undefined
    ? { transition: 'LINK', sourceTransition: String(native) }
    : { transition: hit, sourceTransition: null }
}
