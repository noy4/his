export type YoutubeUrlKind = 'video' | 'channel' | 'playlist'
// filter axis — 'video' excludes 'shorts'; 'other' = no entity
export type YoutubeVisitKind = 'all' | YoutubeUrlKind | 'shorts' | 'other'

export interface YoutubeVisitsFilter {
  month?: string
  kind?: YoutubeVisitKind
  cursor?: string
  limit?: number
}
