import type { EpochMs } from '../../types.ts'

export type YoutubeUrlKind = 'video' | 'channel' | 'playlist'
// filter axis — 'video' excludes 'shorts'; 'search' = results pages; 'other' = no entity, not a search
export type YoutubeVisitKind = 'all' | YoutubeUrlKind | 'shorts' | 'search' | 'other'

/** kinds that can be charted per day ('all' is the row total) */
export type YoutubeDayKind = 'video' | 'shorts' | 'other'
/** entity kind of a charted day item */
export type YoutubeDayItemKind = Exclude<YoutubeVisitKind, 'all'>

export interface YoutubeDayItem {
  key: string
  kind: YoutubeDayItemKind
  id?: string
  title: string
  url: string
  visits: number
  lastVisit: EpochMs
}

export interface YoutubeStats {
  totals: {
    visits: number
    videos: number
    shorts: number
    firstVisit: EpochMs
    lastVisit: EpochMs
  }
  /** distinct items per kind, as the recent-items list would show them */
  kindCounts: Record<YoutubeVisitKind, number>
  byDay: {
    day: string
    all: number
    video: number
    shorts: number
    other: number
  }[]
  byDayTop: {
    day: string
    video: YoutubeDayItem[]
    shorts: YoutubeDayItem[]
    other: YoutubeDayItem[]
  }[]
  topVideos: {
    id: string
    shorts: boolean
    title: string
    url: string
    visits: number
  }[]
}

export interface YoutubeSearchParams {
  month?: string
  kind?: YoutubeVisitKind
  cursor?: string
  limit?: number
}
