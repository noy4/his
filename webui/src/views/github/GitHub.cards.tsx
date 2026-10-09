import type { HistoryItem } from '@/api'
import { timeLabel } from '@/lib/date'
import { parseGithubTitle, parseGithubUrl } from '@his/core/github'
import type { ReactNode } from 'react'

const cardCls =
  'flex min-w-0 flex-col gap-1.5 rounded-lg border border-border p-3 text-inherit no-underline transition-colors hover:bg-bg-3'

export function CardGrid({ children }: { children: ReactNode }) {
  return <div className="grid grid-cols-[repeat(auto-fill,minmax(240px,1fr))] gap-2">{children}</div>
}

export function VisitCard({ item, avatar }: { item: HistoryItem; avatar: (owner: string, size: number) => ReactNode }) {
  const ref = parseGithubUrl(item.url)
  if (!ref) return null
  const t = parseGithubTitle(item.title || item.url, ref)
  const org = ref.kind
    ? `${ref.owner}/${ref.repo}#${ref.number}${t.meta ? ` · ${t.meta}` : ''}`
    : ref.repo && !ref.root
      ? `${ref.owner}/${ref.repo}`
      : ref.owner
  return (
    <a className={cardCls} href={item.url} target="_blank" rel="noreferrer">
      <div className="flex min-w-0 flex-col items-start gap-2.5">
        {avatar(ref.owner, ref.root ? 36 : 28)}
        <div className="grid w-full min-w-0 leading-[1.35]">
          <span className={`text-sm font-semibold text-text ${ref.root ? 'truncate' : 'line-clamp-2'}`}>{t.name}</span>
          <span className="truncate font-mono text-[0.7rem] text-muted">{org}</span>
        </div>
      </div>
      {t.desc && <p className="line-clamp-2 text-xs text-text-2">{t.desc}</p>}
      <div className="mt-auto flex items-center justify-end gap-2">
        {item.visitCount > 1 && (
          <span className="min-w-5 rounded bg-primary-soft px-1.5 py-px text-center font-mono text-[0.68rem] font-semibold text-primary">
            {item.visitCount}
          </span>
        )}
        <time className="font-mono text-[0.7rem] text-muted">{timeLabel(item.lastVisit)}</time>
      </div>
    </a>
  )
}
