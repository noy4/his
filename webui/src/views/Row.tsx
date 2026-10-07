import type { CSSProperties } from 'react'
import type { HistoryItem } from '@/api'
import { timeLabel } from '@/lib/date'

function hostOf(url: string): string {
  try {
    return new URL(url).hostname.replace(/^www\./, '')
  } catch {
    return url
  }
}

function tileStyle(host: string): CSSProperties {
  let h = 0
  for (let i = 0; i < host.length; i++) h = (h * 31 + host.charCodeAt(i)) % 360
  return { background: `hsl(${h}, 30%, 34%)`, color: `hsl(${h}, 60%, 88%)` }
}

export function Row({ item }: { item: HistoryItem }) {
  const host = hostOf(item.url)
  return (
    <a
      className="flex min-w-0 items-center gap-2.5 rounded-lg px-2 py-2 text-inherit no-underline hover:bg-bg-2"
      href={item.url}
      target="_blank"
      rel="noreferrer"
    >
      <span
        className="relative inline-flex h-[30px] w-[30px] shrink-0 items-center justify-center overflow-hidden rounded-[7px] text-[0.82rem] font-bold select-none"
        style={tileStyle(host)}
        aria-hidden="true"
      >
        <span className="tile-letter">{host.charAt(0).toUpperCase()}</span>
        <img
          className="absolute inset-0 h-full w-full object-contain p-1"
          src={`https://${host}/favicon.ico`}
          alt=""
          loading="lazy"
          referrerPolicy="no-referrer"
          onError={(e) => {
            e.currentTarget.style.display = 'none'
          }}
          onLoad={(e) => {
            const img = e.currentTarget
            if (img.naturalWidth === 0) {
              img.style.display = 'none'
              return
            }
            const tile = img.parentElement as HTMLElement
            const letter = img.previousElementSibling as HTMLElement
            tile.style.background = 'transparent'
            letter.style.display = 'none'
          }}
        />
      </span>
      <span className="grid min-w-0 flex-1 leading-[1.45]">
        <span className="truncate text-[0.88rem] font-medium">
          {item.title || item.url}
        </span>
        <span className="truncate font-mono text-[0.7rem] text-muted">{item.url}</span>
      </span>
      <span className="inline-flex shrink-0 items-center gap-2">
        {item.visitCount > 1 && (
          <span className="min-w-5 rounded bg-primary-soft px-1.5 py-px text-center font-mono text-[0.68rem] font-semibold text-primary">
            {item.visitCount}
          </span>
        )}
        <time className="font-mono text-[0.7rem] text-muted">{timeLabel(item.lastVisit)}</time>
      </span>
    </a>
  )
}
