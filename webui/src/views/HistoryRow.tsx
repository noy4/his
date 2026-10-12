import type { HistoryItem, HistoryVisit } from '@/api'
import type { ReactNode } from 'react'
import { timeLabel } from '@/lib/date'
import { Favicon } from './Favicon'

function hostOf(url: string): string {
  try {
    return new URL(url).hostname.replace(/^www\./, '')
  } catch {
    return url
  }
}

export function HistoryRow({ item, icon, title }: { item: HistoryItem | HistoryVisit; icon?: ReactNode; title?: ReactNode }) {
  const host = hostOf(item.url)
  const isVisit = 'visitTime' in item
  const time = isVisit ? item.visitTime : item.lastVisit
  return (
    <a
      className="flex min-w-0 items-center gap-2.5 rounded-lg px-2 py-2 text-inherit no-underline hover:bg-bg-3 cursor-default"
      href={item.url}
      target="_blank"
      rel="noreferrer"
    >
      {icon ?? <Favicon host={host} />}
      <span className="grid min-w-0 flex-1 leading-[1.45]">
        <span className="truncate text-[0.88rem] font-medium">
          {title ?? (item.title || item.url)}
        </span>
        <span className="truncate font-mono text-[0.7rem] text-muted">{item.url}</span>
      </span>
      <span className="inline-flex shrink-0 items-center gap-2">
        {item.visitCount > 1 && (
          <span title={`${item.visitCount} ${isVisit ? 'total visits to this URL' : 'visits'}`} className="min-w-5 rounded bg-primary-soft px-1.5 py-px text-center font-mono text-[0.68rem] font-semibold text-primary">
            {item.visitCount}
          </span>
        )}
        <time className="font-mono text-[0.7rem] text-muted">{timeLabel(time)}</time>
      </span>
    </a>
  )
}
