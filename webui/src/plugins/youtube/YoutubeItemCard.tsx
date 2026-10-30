import type { HistoryItem } from '@his/core'
import { parseYoutubeTitle, parseYoutubeUrl } from '@his/core'
import { cn } from 'cn'
import type { ReactNode } from 'react'
import { VisitCount } from '@/components/view/RecentItems'
import { YoutubeItemAvatar } from './Youtube.components'
import { youtubeItemLabel } from './youtube.labels'

export function YoutubeItemCardGrid({ children }: { children: ReactNode }) {
  return <div className="grid grid-cols-[repeat(auto-fill,minmax(240px,1fr))] gap-2">{children}</div>
}

export function YoutubeItemCard({ item }: { item: HistoryItem }) {
  const info = parseYoutubeUrl(item.url)
  if (!info) return null
  const { name } = parseYoutubeTitle(item.title || item.url, info)
  return (
    <a
      href={item.url}
      target="_blank"
      rel="noreferrer"
      className={cn(
        'flex min-w-0 items-start gap-2.5 rounded-lg border border-border p-3 text-inherit no-underline',
        'transition-colors hover:bg-bg-3',
      )}
    >
      <YoutubeItemAvatar info={info} size={36} />
      <div className="grid min-w-0 flex-1 gap-0.5 leading-snug">
        <span className="line-clamp-2 text-sm font-semibold text-text">{name}</span>
        <span className="truncate font-mono text-[11px] text-muted">{youtubeItemLabel(info)}</span>
      </div>
      <VisitCount n={item.visitCount} />
    </a>
  )
}
