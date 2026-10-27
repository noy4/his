import type { EpochMs } from '../../types.ts'

export type YoutubeUrlKind = 'video' | 'channel' | 'playlist'
// filter axis — 'video' excludes 'shorts'; 'other' = no entity
export type YoutubeVisitKind = 'all' | YoutubeUrlKind | 'shorts' | 'other'

export interface YoutubeStats {
  totals: {
    visits: number
    videos: number
    shorts: number
    firstVisit: EpochMs
    lastVisit: EpochMs
  }
}

export interface YoutubeVisitsFilter {
  month?: string
  kind?: YoutubeVisitKind
  cursor?: string
  limit?: number
}
