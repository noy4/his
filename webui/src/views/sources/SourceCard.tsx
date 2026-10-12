import type { SourceProfile } from '@/app/api'
import { browserName } from '@/lib/browser/browser'
import { BrowserIcon } from '@/lib/browser/BrowserIcon'
import { relativeAgo } from '@/lib/date'
import { cn } from 'cn'
import Check from '~icons/mdi/check'
import { type ReactNode } from 'react'

interface Props {
  source: SourceProfile
  selected: boolean
  onToggle: () => void
}

export function SourceCard({ source, selected, onToggle }: Props) {
  return (
    <SourceCardRoot selected={selected} onToggle={onToggle}>
      <SourceCardHead>
        <SourceCardIcon browser={source.browser} />
        <SourceCardName
          name={browserName(source.browser)}
          detail={source.profile}
        />
      </SourceCardHead>
      <SourceCardStats
        visits={source.visits}
        lastVisit={source.lastVisit}
      />
      <SourceCardStatus pending={source.pending} lastRunAt={source.watermark.lastRunAt} />
    </SourceCardRoot>
  )
}

// --- components ---

// SourceCardRoot

function SourceCardRoot({ selected, onToggle, children }: { selected: boolean; onToggle: () => void; children: ReactNode }) {
  return (
    <button
      type="button"
      aria-pressed={selected}
      onClick={onToggle}
      className={cn(
        'relative flex flex-col gap-2.5 rounded-lg border bg-bg-2 p-4 text-left transition-colors',
        selected
          ? 'border-primary ring-1 ring-primary'
          : 'hover:border-border hover:bg-bg-3',
      )}
    >
      {children}
      <SourceCardCheck selected={selected} />
    </button>
  )
}

function SourceCardCheck({ selected }: { selected: boolean }) {
  return (
    <span
      aria-hidden="true"
      className={cn(
        'absolute top-3 right-3 inline-flex h-4.5 w-4.5 items-center justify-center rounded-[5px] border transition-colors',
        selected
          ? 'border-primary bg-primary text-white'
          : 'border-border bg-bg-3',
      )}
    >
      {selected && <Check width={14} height={14} />}
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

function SourceCardStatus({ pending, lastRunAt }: { pending: boolean | null; lastRunAt: number | null }) {
  if (lastRunAt === null) return <SourceCardStatusDot label="never synced" />
  if (pending === null) return null
  return <SourceCardStatusDot label={pending ? 'sync needed' : 'up to date'} warn={pending} />
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

function SourceCardStats({ visits, lastVisit }: { visits: number; lastVisit: number | null }) {
  if (visits === 0) {
    return <span className="font-mono text-xs text-muted">no visits</span>
  }
  return (
    <span className="flex items-center gap-1.5 font-mono text-xs text-muted tabular-nums">
      <span>{visits.toLocaleString()} visits</span>
      <span className="text-muted/50">·</span>
      <span>{relativeAgo(lastVisit)}</span>
    </span>
  )
}
