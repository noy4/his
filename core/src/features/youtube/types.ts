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
  byDay: {
    day: string
    all: number
    video: number
    shorts: number
    other: number
  }[]
  topVideos: {
    id: string
    shorts: boolean
    title: string
    url: string
    visits: number
  }[]
}

export interface YoutubeSearchFilter {
  month?: string
  kind?: YoutubeVisitKind
  cursor?: string
  limit?: number
}
