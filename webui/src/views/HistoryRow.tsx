import type { HistoryItem, HistoryVisit } from '@/app/api'
import { timeLabel } from '@/lib/date'
import { hostWithoutWww } from '@his/core'
import { cn } from 'cn'
import type { ComponentProps, ReactNode } from 'react'
import { Favicon } from './Favicon'

type HistoryItemRowProps = {
  item: HistoryItem
  icon?: ReactNode
  title?: ReactNode
}

export function HistoryItemRow({ item, icon, title }: HistoryItemRowProps) {
  return (
    <HistoryRowFrame
      href={item.url}
      icon={icon ?? <Favicon host={hostWithoutWww(item.url)} />}
      title={title ?? (item.title || item.url)}
      url={item.url}
      time={item.lastVisit}
      visitCount={item.visitCount}
    />
  )
}

export function HistoryVisitRow({ item }: { item: HistoryVisit }) {
  return (
    <HistoryRowFrame
      href={item.url}
      icon={<Favicon host={hostWithoutWww(item.url)} />}
      title={item.title || item.url}
      url={item.url}
      time={item.visitTime}
      visitCount={item.visitCount}
    />
  )
}

// --- components ---

type HistoryRowFrameProps = {
  href: string
  icon: ReactNode
  title: ReactNode
  url: string
  time: number
  visitCount: number
}

function HistoryRowFrame({ href, icon, title, url, time, visitCount }: HistoryRowFrameProps) {
  return (
    <HistoryRowRoot href={href}>
      {icon}
      <HistoryRowBody>
        <HistoryRowTitle>{title}</HistoryRowTitle>
        <HistoryRowUrl text={url} />
      </HistoryRowBody>
      <HistoryRowMeta>
        <HistoryCountBadge value={visitCount} />
        <HistoryTime value={time} />
      </HistoryRowMeta>
    </HistoryRowRoot>
  )
}

function HistoryRowRoot({ className, ...props }: ComponentProps<'a'>) {
  return (
    <a
      {...props}
      className={cn('flex min-w-0 items-center gap-2.5 rounded-lg px-2 py-2 text-inherit no-underline hover:bg-bg-3 cursor-default', className)}
      target="_blank"
      rel="noreferrer"
    />
  )
}

function HistoryRowBody({ className, ...props }: ComponentProps<'span'>) {
  return <span {...props} className={cn('grid min-w-0 flex-1', className)} />
}

function HistoryRowTitle({ className, ...props }: ComponentProps<'span'>) {
  return (
    <span {...props} className={cn('truncate text-sm font-medium', className)} />
  )
}

function HistoryRowUrl({ text, className, ...props }: Omit<ComponentProps<'span'>, 'children'> & { text: string }) {
  return (
    <span {...props} className={cn('truncate font-mono text-xs text-muted', className)}>{text}</span>
  )
}

function HistoryRowMeta({ className, ...props }: ComponentProps<'span'>) {
  return <span {...props} className={cn('inline-flex shrink-0 items-center gap-2', className)} />
}

function HistoryCountBadge({ value, className, ...props }: Omit<ComponentProps<'span'>, 'children'> & { value: number }) {
  if (value <= 1) return null
  return (
    <span
      {...props}
      title={`${value} visits`}
      className={cn('min-w-5 rounded bg-primary-soft px-1.5 py-px text-center font-mono text-xs font-semibold text-primary', className)}
    >
      {value}
    </span>
  )
}

function HistoryTime({ value, className, ...props }: Omit<ComponentProps<'time'>, 'children'> & { value: number }) {
  return (
    <time {...props} className={cn('font-mono text-xs text-muted', className)}>{timeLabel(value)}</time>
  )
}
