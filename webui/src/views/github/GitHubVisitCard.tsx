import type { HistoryItem } from '@/app/api'
import { timeLabel } from '@/lib/date'
import { parseGithubTitle, parseGithubUrl } from '@his/core'
import { cn } from 'cn'
import type { ComponentProps, ReactNode } from 'react'
import { GitHubItemAvatar } from './GitHub.components'

export function GitHubVisitCardGrid({ children }: { children: ReactNode }) {
  return <div className="grid grid-cols-[repeat(auto-fill,minmax(240px,1fr))] gap-2">{children}</div>
}

export function GitHubVisitCard({ item }: { item: HistoryItem }) {
  const urlInfo = parseGithubUrl(item.url)
  if (!urlInfo) return null
  const titleInfo = parseGithubTitle(item.title || item.url, urlInfo)
  // Issue/PR: owner/repo#number (+ author).
  // Other repo pages: owner/repo; repo roots and profiles: owner.
  const metaText = urlInfo.kind
    ? `${urlInfo.owner}/${urlInfo.repo}#${urlInfo.number}`
    : urlInfo.repo && !urlInfo.root
      ? `${urlInfo.owner}/${urlInfo.repo}`
      : urlInfo.owner

  return (
    <GitHubVisitCardRoot href={item.url}>
      <GitHubVisitCardHeader>
        <GitHubItemAvatar
          owner={urlInfo.owner}
          kind={urlInfo.kind}
          size={urlInfo.root ? 36 : 28}
        />
        <GitHubVisitCardHeading>
          <GitHubVisitCardTitle
            text={titleInfo.name}
            className={urlInfo.root ? 'truncate' : 'line-clamp-2'}
          />
          <GitHubVisitCardMeta text={metaText} />
        </GitHubVisitCardHeading>
      </GitHubVisitCardHeader>

      <GitHubVisitCardDescription text={titleInfo.desc} />
      <GitHubVisitCardFooter>
        <GitHubVisitCountBadge value={item.visitCount} />
        <GitHubVisitTime value={item.lastVisit} />
      </GitHubVisitCardFooter>
    </GitHubVisitCardRoot>
  )
}

// --- components ---

export function GitHubVisitCardRoot({ className, ...props }: ComponentProps<'a'>) {
  return (
    <a
      target="_blank"
      rel="noreferrer"
      {...props}
      className={cn('flex min-w-0 flex-col gap-1.5 rounded-lg border border-border p-3 text-inherit no-underline transition-colors hover:bg-bg-3', className)}
    />
  )
}

export function GitHubVisitCardHeader({ className, ...props }: ComponentProps<'div'>) {
  return (
    <div {...props} className={cn('flex min-w-0 flex-col items-start gap-2.5', className)} />
  )
}

export function GitHubVisitCardHeading({ className, ...props }: ComponentProps<'div'>) {
  return (
    <div {...props} className={cn('grid w-full min-w-0 leading-snug', className)} />
  )
}

export function GitHubVisitCardTitle({ text, className, ...props }: Omit<ComponentProps<'span'>, 'children'> & { text: string }) {
  return (
    <span {...props} className={cn('text-sm font-semibold text-text', className)}>{text}</span>
  )
}

export function GitHubVisitCardMeta({ text, className, ...props }: Omit<ComponentProps<'span'>, 'children'> & { text: string }) {
  return (
    <span {...props} className={cn('truncate font-mono text-[11px] text-muted', className)}>{text}</span>
  )
}

export function GitHubVisitCardDescription({ text, className, ...props }: Omit<ComponentProps<'p'>, 'children'> & { text?: string }) {
  if (!text) return null
  return (
    <p {...props} className={cn('line-clamp-2 text-xs text-text-2', className)}>{text}</p>
  )
}

export function GitHubVisitCardFooter({ className, ...props }: ComponentProps<'div'>) {
  return (
    <div {...props} className={cn('mt-auto flex items-center justify-end gap-2', className)} />
  )
}

export function GitHubVisitCountBadge({ value, className, ...props }: Omit<ComponentProps<'span'>, 'children'> & { value: number }) {
  if (value <= 1) return null
  return (
    <span {...props} className={cn('min-w-5 rounded bg-primary-soft px-1.5 py-px text-center font-mono text-xs font-semibold text-primary', className)}>{value}</span>
  )
}

export function GitHubVisitTime({ value, className, ...props }: Omit<ComponentProps<'time'>, 'children'> & { value: number }) {
  return (
    <time {...props} className={cn('font-mono text-xs text-muted', className)}>{timeLabel(value)}</time>
  )
}
