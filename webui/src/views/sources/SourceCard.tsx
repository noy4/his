import type { SourceEntry } from './sources.model'
import { browserName } from '@/lib/browser/browser'
import { BrowserIcon } from '@/lib/browser/BrowserIcon'
import { relativeAgo } from '@/lib/date'
import { cn } from 'cn'
import Check from '~icons/mdi/check'
import { type ReactNode } from 'react'

interface Props {
  entry: SourceEntry
  enabled: boolean
  onToggle: () => void
}

export function SourceCard({ entry, enabled, onToggle }: Props) {
  return (
    <SourceCardRoot enabled={enabled} onToggle={onToggle}>
      <SourceCardHead>
        <SourceCardIcon browser={entry.browser} />
        <SourceCardName
          name={browserName(entry.browser)}
          detail={entry.profile}
        />
      </SourceCardHead>
      <SourceCardStats entry={entry} />
      <SourceCardStatus entry={entry} />
    </SourceCardRoot>
  )
}

// --- components ---

// SourceCardRoot

function SourceCardRoot({ enabled, onToggle, children }: { enabled: boolean; onToggle: () => void; children: ReactNode }) {
  return (
    <button
      type="button"
      aria-pressed={enabled}
      onClick={onToggle}
      className={cn(
        'relative flex flex-col gap-2.5 rounded-lg border bg-bg-2 p-4 text-left transition-colors',
        enabled
          ? 'border-primary ring-1 ring-primary'
          : 'hover:border-border hover:bg-bg-3',
      )}
    >
      {children}
      <SourceCardCheck enabled={enabled} />
    </button>
  )
}

function SourceCardCheck({ enabled }: { enabled: boolean }) {
  return (
    <span
      aria-hidden="true"
      className={cn(
        'absolute top-3 right-3 inline-flex h-4.5 w-4.5 items-center justify-center rounded-[5px] border transition-colors',
        enabled
          ? 'border-primary bg-primary text-white'
          : 'border-border bg-bg-3',
      )}
    >
      {enabled && <Check width={14} height={14} />}
    </span>
  )
}

// SourceCardHead

function SourceCardHead({ children }: { children: ReactNode }) {
  return <span className="flex min-w-0 flex-col items-start gap-2">{children}</span>
}

function SourceCardIcon({ browser }: { browser: string }) {
  return (
    <span className="inline-flex h-10 w-10 shrink-0 items-center justify-center rounded-lg bg-bg-3">
      <BrowserIcon browser={browser} width={22} height={22} />
    </span>
  )
}

function SourceCardName({ name, detail }: { name: string; detail: string }) {
  return (
    <span className="grid min-w-0">
      <span className="truncate text-sm font-medium">{name}</span>
      <span className="truncate font-mono text-xs text-muted">{detail}</span>
    </span>
  )
}

// SourceCardStatus

function SourceCardStatus({ entry }: { entry: SourceEntry }) {
  if (!entry.registered || entry.watermark.lastRunAt === null) return <SourceCardStatusDot label="never synced" />
  if (entry.pending === null) return null
  return <SourceCardStatusDot label={entry.pending ? 'sync needed' : 'up to date'} warn={entry.pending} />
}

function SourceCardStatusDot({ label, warn }: { label: string; warn?: boolean }) {
  return (
    <span
      className={cn(
        'inline-flex w-fit items-center gap-1.5 rounded px-1.5 py-px font-mono text-xs',
        warn ? 'bg-warn-soft text-warn' : 'bg-bg-3 text-muted',
      )}
    >
      <span aria-hidden="true" className="size-1.5 rounded-full bg-current" />
      {label}
    </span>
  )
}

// SourceCardStats

function SourceCardStats({ entry }: { entry: SourceEntry }) {
  if (!entry.registered || entry.visits === 0) {
    return <span className="font-mono text-xs text-muted">no visits</span>
  }
  return (
    <span className="flex items-center gap-1.5 font-mono text-xs text-muted tabular-nums">
      <span>{entry.visits.toLocaleString()} visits</span>
      <span className="text-muted/50">·</span>
      <span>{relativeAgo(entry.lastVisit)}</span>
    </span>
  )
}
