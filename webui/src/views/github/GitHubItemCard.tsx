import type { HistoryItem } from '@/app/api'
import { parseGithubTitle, parseGithubUrl } from '@his/core'
import { cn } from 'cn'
import type { ComponentProps, ReactNode } from 'react'
import { GitHubItemAvatar } from './GitHub.components'

export function GitHubItemCardGrid({ children }: { children: ReactNode }) {
  return <div className="grid grid-cols-[repeat(auto-fill,minmax(240px,1fr))] gap-2">{children}</div>
}

export function GitHubItemCard({ item }: { item: HistoryItem }) {
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
    <GitHubItemCardRoot href={item.url}>
      <GitHubItemCardHeader>
        <GitHubItemAvatar
          owner={urlInfo.owner}
          kind={urlInfo.kind}
          size={urlInfo.root ? 36 : 28}
        />
        <GitHubItemCardHeading>
          <GitHubItemCardTitle
            text={titleInfo.name}
            className={urlInfo.root ? 'truncate' : 'line-clamp-2'}
          />
          <GitHubItemCardMeta text={metaText} />
        </GitHubItemCardHeading>
      </GitHubItemCardHeader>

      <GitHubItemCardDescription text={titleInfo.desc} />
    </GitHubItemCardRoot>
  )
}

// --- components ---

function GitHubItemCardRoot({ className, ...props }: ComponentProps<'a'>) {
  return (
    <a
      target="_blank"
      rel="noreferrer"
      {...props}
      className={cn('flex min-w-0 flex-col gap-1.5 rounded-lg border border-border p-3 text-inherit no-underline transition-colors hover:bg-bg-3', className)}
    />
  )
}

function GitHubItemCardHeader({ className, ...props }: ComponentProps<'div'>) {
  return (
    <div {...props} className={cn('flex min-w-0 flex-col items-start gap-2.5', className)} />
  )
}

function GitHubItemCardHeading({ className, ...props }: ComponentProps<'div'>) {
  return (
    <div {...props} className={cn('grid w-full min-w-0 leading-snug', className)} />
  )
}

function GitHubItemCardTitle({ text, className, ...props }: Omit<ComponentProps<'span'>, 'children'> & { text: string }) {
  return (
    <span {...props} className={cn('text-sm font-semibold text-text', className)}>{text}</span>
  )
}

function GitHubItemCardMeta({ text, className, ...props }: Omit<ComponentProps<'span'>, 'children'> & { text: string }) {
  return (
    <span {...props} className={cn('truncate font-mono text-[11px] text-muted', className)}>{text}</span>
  )
}

function GitHubItemCardDescription({ text, className, ...props }: Omit<ComponentProps<'p'>, 'children'> & { text?: string }) {
  if (!text) return null
  return (
    <p {...props} className={cn('line-clamp-2 text-xs text-text-2 mb-1', className)}>{text}</p>
  )
}
