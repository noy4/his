import type { HistoryItem, HistoryVisit } from '@/app/api'
import { dateLabel, timeLabel } from '@/lib/date'
import { cn } from 'cn'
import { hostWithoutWww } from '@his/core'
import type { ComponentProps, ReactNode } from 'react'
import { Favicon } from './Favicon'

export function HistoryCardGrid({ children }: { children: ReactNode }) {
  return <div className="grid grid-cols-[repeat(auto-fill,minmax(240px,1fr))] gap-2">{children}</div>
}

export function HistoryItemCard({ item }: { item: HistoryItem }) {
  return (
    <HistoryCardFrame
      href={item.url}
      title={item.title || item.url}
      host={hostWithoutWww(item.url)}
      time={item.lastVisit}
      visitCount={item.visitCount}
    />
  )
}

export function HistoryVisitCard({ item }: { item: HistoryVisit }) {
  return (
    <HistoryCardFrame
      href={item.url}
      title={item.title || item.url}
      host={hostWithoutWww(item.url)}
      time={item.visitTime}
      visitCount={item.visitCount}
    />
  )
}

// --- components ---

function HistoryCardFrame({ href, title, host, time, visitCount }: {
  href: string
  title: string
  host: string
  time: number
  visitCount: number
}) {
  return (
    <HistoryCardRoot href={href}>
      <HistoryCardHeader>
        <Favicon host={host} size={28} />
        <HistoryCardHeading>
          <HistoryCardTitle text={title} />
          <HistoryCardMeta text={host} />
        </HistoryCardHeading>
      </HistoryCardHeader>

      <HistoryCardFooter>
        <HistoryCountBadge value={visitCount} />
        <HistoryTime value={time} />
      </HistoryCardFooter>
    </HistoryCardRoot>
  )
}

function HistoryCardRoot({ className, ...props }: ComponentProps<'a'>) {
  return (
    <a
      target="_blank"
      rel="noreferrer"
      {...props}
      className={cn('flex min-w-0 flex-col gap-1.5 rounded-lg border border-border p-3 text-inherit no-underline transition-colors hover:bg-bg-3', className)}
    />
  )
}

function HistoryCardHeader({ className, ...props }: ComponentProps<'div'>) {
  return (
    <div {...props} className={cn('flex min-w-0 flex-col items-start gap-2.5', className)} />
  )
}

function HistoryCardHeading({ className, ...props }: ComponentProps<'div'>) {
  return (
    <div {...props} className={cn('grid w-full min-w-0 leading-snug', className)} />
  )
}

function HistoryCardTitle({ text, className, ...props }: Omit<ComponentProps<'span'>, 'children'> & { text: string }) {
  return (
    <span {...props} className={cn('line-clamp-2 text-sm font-semibold text-text', className)}>{text}</span>
  )
}

function HistoryCardMeta({ text, className, ...props }: Omit<ComponentProps<'span'>, 'children'> & { text: string }) {
  return (
    <span {...props} className={cn('truncate font-mono text-[11px] text-muted', className)}>{text}</span>
  )
}

function HistoryCardFooter({ className, ...props }: ComponentProps<'div'>) {
  return (
    <div {...props} className={cn('mt-auto flex items-center justify-end gap-2', className)} />
  )
}

function HistoryCountBadge({ value, className, ...props }: Omit<ComponentProps<'span'>, 'children'> & { value: number }) {
  if (value <= 1) return null
  return (
    <span {...props} className={cn('min-w-5 rounded bg-primary-soft px-1.5 py-px text-center font-mono text-xs font-semibold text-primary', className)}>{value}</span>
  )
}

function HistoryTime({ value, className, ...props }: Omit<ComponentProps<'time'>, 'children'> & { value: number }) {
  return (
    <time
      {...props}
      title={`${dateLabel(value)} ${timeLabel(value)}`}
      className={cn('font-mono text-xs text-muted', className)}
    >
      {timeLabel(value)}
    </time>
  )
}
