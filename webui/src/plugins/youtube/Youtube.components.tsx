import type { YoutubeUrlInfo } from '@his/core'
import { cn } from 'cn'
import PlayIcon from '~icons/mdi/play-circle-outline'
import PlaylistIcon from '~icons/mdi/playlist-play'
import YoutubeIcon from '~icons/mdi/youtube'

// 16:9 preview frame — real thumbnail when we have a video id, else a kind placeholder
export function YoutubeThumb({ id, shorts, width = 64, className }: { id?: string; shorts?: boolean; width?: number; className?: string }) {
  const height = Math.round((width * 9) / 16)
  if (id === undefined) {
    return (
      <span
        aria-hidden="true"
        className={cn('flex shrink-0 items-center justify-center rounded bg-bg-3 text-muted', className)}
        style={{ width, height }}
      >
        <PlayIcon width={18} height={18} />
      </span>
    )
  }
  return (
    <span
      className={cn('relative block shrink-0 overflow-hidden rounded bg-bg-3', className)}
      style={{ width, height }}
    >
      <img
        src={`https://i.ytimg.com/vi/${id}/mqdefault.jpg`}
        alt=""
        loading="lazy"
        className="h-full w-full object-cover"
      />
      {shorts === true && (
        <span className="absolute bottom-0.5 left-0.5 rounded bg-black/70 px-1 text-[9px] font-semibold text-white">
          Shorts
        </span>
      )}
    </span>
  )
}

// deterministic colored initial — no network avatar for channels (local-only)
export function ChannelAvatar({ id, size = 32, className }: { id: string; size?: number; className?: string }) {
  const name = id.replace(/^@/, '')
  const initial = (name.charAt(0) || '@').toUpperCase()
  return (
    <span
      aria-hidden="true"
      className={cn('flex shrink-0 items-center justify-center rounded-full font-semibold text-white', className)}
      style={{ width: size, height: size, fontSize: Math.round(size * 0.44), background: `hsl(${hashHue(name)} 50% 42%)` }}
    >
      {initial}
    </span>
  )
}

export function PlaylistBadge({ size = 32, className }: { size?: number; className?: string }) {
  return (
    <span
      aria-hidden="true"
      className={cn('flex shrink-0 items-center justify-center rounded bg-bg-3 text-muted', className)}
      style={{ width: size, height: size }}
    >
      <PlaylistIcon width={Math.round(size * 0.6)} height={Math.round(size * 0.6)} />
    </span>
  )
}

export function YoutubeItemAvatar({ info, size = 32, className }: { info: YoutubeUrlInfo; size?: number; className?: string }) {
  if (info.kind === 'video')
    return <YoutubeThumb id={info.id} shorts={info.shorts} width={Math.round(size * 1.6)} className={className} />
  if (info.kind === 'channel')
    return <ChannelAvatar id={info.id ?? ''} size={size} className={className} />
  if (info.kind === 'playlist')
    return <PlaylistBadge size={size} className={className} />
  return (
    <span
      aria-hidden="true"
      className={cn('flex shrink-0 items-center justify-center rounded bg-bg-3 text-muted', className)}
      style={{ width: size, height: size }}
    >
      <YoutubeIcon width={Math.round(size * 0.6)} height={Math.round(size * 0.6)} />
    </span>
  )
}

function hashHue(s: string): number {
  let h = 0
  for (let i = 0; i < s.length; i++) h = (h * 31 + s.charCodeAt(i)) | 0
  return Math.abs(h) % 360
}
