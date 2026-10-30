import type { YoutubeUrlInfo, YoutubeVisitKind } from '@his/core'

export const YOUTUBE_KIND_LABELS: Record<YoutubeVisitKind, string> = {
  all: 'All',
  video: 'Videos',
  shorts: 'Shorts',
  channel: 'Channels',
  playlist: 'Playlists',
  other: 'Other',
}

// singular label for a single item's kind
export function youtubeItemLabel(info: YoutubeUrlInfo): string {
  if (info.kind === 'video') return info.shorts === true ? 'Shorts' : 'Video'
  if (info.kind === 'channel') return 'Channel'
  if (info.kind === 'playlist') return 'Playlist'
  return 'YouTube'
}
