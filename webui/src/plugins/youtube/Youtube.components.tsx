import type { YoutubeUrlInfo } from '@his/core'
import type { SyntheticEvent } from 'react'
import { cn } from 'cn'
import SearchIcon from '~icons/mdi/magnify'
import PlayIcon from '~icons/mdi/play-circle-outline'
import PlaylistIcon from '~icons/mdi/playlist-play'
import YoutubeIcon from '~icons/mdi/youtube'

// Shorts expose a vertical thumbnail; regular videos use the 16:9 one
function thumbSrc(id: string, shorts?: boolean): string {
  return `https://i.ytimg.com/vi/${id}/${shorts ? 'oardefault' : 'mqdefault'}.jpg`
}

function onThumbError(e: SyntheticEvent<HTMLImageElement>): void {
  const img = e.currentTarget
  if (!img.src.includes('/oardefault.jpg')) return
  img.src = img.src.replace('/oardefault.jpg', '/mqdefault.jpg')
}

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
        src={thumbSrc(id, shorts)}
        alt=""
        loading="lazy"
        onError={shorts ? onThumbError : undefined}
        className="h-full w-full object-cover"
      />
      {shorts && (
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
  const iconSize = Math.round(size * 0.6)
  return (
    <span
      aria-hidden="true"
      className={cn('flex shrink-0 items-center justify-center rounded bg-bg-3 text-muted', className)}
      style={{ width: size, height: size }}
    >
      <PlaylistIcon width={iconSize} height={iconSize} />
    </span>
  )
}

// full-width 16:9 preview for card layouts
export function YoutubeItemThumb({ info, className }: { info: YoutubeUrlInfo; className?: string }) {
  if (info.kind === 'video') {
    return (
      <span className={cn('relative block aspect-video w-full overflow-hidden rounded bg-bg-3', className)}>
        <img
          src={thumbSrc(info.id ?? '', info.shorts)}
          alt=""
          loading="lazy"
          onError={info.shorts ? onThumbError : undefined}
          className="h-full w-full object-cover"
        />
        {info.shorts && (
          <span className="absolute bottom-1 left-1 rounded bg-black/70 px-1 text-[10px] font-semibold text-white">
            Shorts
          </span>
        )}
      </span>
    )
  }
  const size = 48
  return (
    <span className={cn('flex aspect-video w-full items-center justify-center rounded bg-bg-3 text-muted', className)}>
      {info.kind === 'channel'
        ? <ChannelAvatar id={info.id ?? ''} size={size} />
        : info.kind === 'playlist'
          ? <PlaylistBadge size={size} />
          : info.search
            ? <SearchIcon width={size} height={size} />
            : <YoutubeIcon width={size} height={size} />}
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
  const iconSize = Math.round(size * 0.6)
  return (
    <span
      aria-hidden="true"
      className={cn('flex shrink-0 items-center justify-center rounded bg-bg-3 text-muted', className)}
      style={{ width: size, height: size }}
    >
      {info.search
        ? <SearchIcon width={iconSize} height={iconSize} />
        : <YoutubeIcon width={iconSize} height={iconSize} />}
    </span>
  )
}

function hashHue(s: string): number {
  let h = 0
  for (let i = 0; i < s.length; i++) h = (h * 31 + s.charCodeAt(i)) | 0
  return Math.abs(h) % 360
}
