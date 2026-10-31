import type { EpochMs } from '../../types.ts'

export interface KeywordStats {
  totals: {
    searches: number
    keywords: number
    firstVisit: EpochMs
    lastVisit: EpochMs
  }
  byDay: { day: string; visits: number }[]
}

export interface KeywordSearchParams {
  month?: string
  cursor?: string
  limit?: number
}
