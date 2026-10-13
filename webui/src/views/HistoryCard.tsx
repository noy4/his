import type { HistoryItem } from '@/app/api'
import { timeLabel } from '@/lib/date'
import { cn } from 'cn'
import type { ComponentProps, ReactNode } from 'react'
import { Favicon } from './Favicon'

function hostOf(url: string): string {
  try {
    return new URL(url).hostname.replace(/^www\./, '')
  } catch {
    return url
  }
}

export function HistoryCardGrid({ children }: { children: ReactNode }) {
  return <div className="grid grid-cols-[repeat(auto-fill,minmax(240px,1fr))] gap-2">{children}</div>
}

export function HistoryCard({ item }: { item: HistoryItem }) {
  const host = hostOf(item.url)
  return (
    <HistoryCardRoot href={item.url}>
      <HistoryCardHeader>
        <Favicon host={host} size={28} />
        <HistoryCardHeading>
          <HistoryCardTitle text={item.title || item.url} />
          <HistoryCardMeta text={host} />
        </HistoryCardHeading>
      </HistoryCardHeader>

      <HistoryCardFooter>
        <HistoryCountBadge value={item.visitCount} />
        <HistoryTime value={item.lastVisit} />
      </HistoryCardFooter>
    </HistoryCardRoot>
  )
}

// --- components ---

export function HistoryCardRoot({ className, ...props }: ComponentProps<'a'>) {
  return (
    <a
      target="_blank"
      rel="noreferrer"
      {...props}
      className={cn('flex min-w-0 flex-col gap-1.5 rounded-lg border border-border p-3 text-inherit no-underline transition-colors hover:bg-bg-3', className)}
    />
  )
}

export function HistoryCardHeader({ className, ...props }: ComponentProps<'div'>) {
  return (
    <div {...props} className={cn('flex min-w-0 flex-col items-start gap-2.5', className)} />
  )
}

export function HistoryCardHeading({ className, ...props }: ComponentProps<'div'>) {
  return (
    <div {...props} className={cn('grid w-full min-w-0 leading-snug', className)} />
  )
}

export function HistoryCardTitle({ text, className, ...props }: Omit<ComponentProps<'span'>, 'children'> & { text: string }) {
  return (
    <span {...props} className={cn('line-clamp-2 text-sm font-semibold text-text', className)}>{text}</span>
  )
}

export function HistoryCardMeta({ text, className, ...props }: Omit<ComponentProps<'span'>, 'children'> & { text: string }) {
  return (
    <span {...props} className={cn('truncate font-mono text-[11px] text-muted', className)}>{text}</span>
  )
}

export function HistoryCardFooter({ className, ...props }: ComponentProps<'div'>) {
  return (
    <div {...props} className={cn('mt-auto flex items-center justify-end gap-2', className)} />
  )
}

export function HistoryCountBadge({ value, className, ...props }: Omit<ComponentProps<'span'>, 'children'> & { value: number }) {
  if (value <= 1) return null
  return (
    <span {...props} className={cn('min-w-5 rounded bg-primary-soft px-1.5 py-px text-center font-mono text-xs font-semibold text-primary', className)}>{value}</span>
  )
}

export function HistoryTime({ value, className, ...props }: Omit<ComponentProps<'time'>, 'children'> & { value: number }) {
  return (
    <time {...props} className={cn('font-mono text-xs text-muted', className)}>{timeLabel(value)}</time>
  )
}
