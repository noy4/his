import type { HistoryItem } from '@his/core'
import { parseYoutubeTitle, parseYoutubeUrl } from '@his/core'
import { cn } from 'cn'
import type { ReactNode } from 'react'
import { VisitCount } from '@/components/view/RecentItems'
import { YoutubeItemThumb } from './Youtube.components'

export function YoutubeItemCardGrid({ children }: { children: ReactNode }) {
  return <div className="grid grid-cols-[repeat(auto-fill,minmax(200px,1fr))] gap-2">{children}</div>
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
        'flex min-w-0 flex-col gap-2 rounded-lg border border-border p-2 text-inherit no-underline',
        'transition-colors hover:bg-bg-3',
      )}
    >
      <YoutubeItemThumb info={info} />
      <div className="flex min-w-0 items-start gap-2">
        <span className="line-clamp-2 min-w-0 flex-1 text-sm font-semibold text-text">{name}</span>
        {item.visitCount > 1 && <VisitCount n={item.visitCount} />}
      </div>
    </a>
  )
}
