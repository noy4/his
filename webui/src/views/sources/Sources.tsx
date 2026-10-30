import { SourceCard } from './SourceCard'
import { useModel } from '@/lib/useModel'
import { AppModel } from '@/app/app'
import { SourcesModel, type SourceEntry } from './sources.model'
import type { SyncSummary } from '@/app/api'
import { sourceKey } from '@his/core'
import { cn } from 'cn'
import { buttonPrimary } from '@/components/ui/button'
import { dateLabel, relativeAgo, timeLabel } from '@/lib/date'
import { type ComponentProps, type ReactNode } from 'react'
import SelectIcon from '~icons/mdi/checkbox-multiple-blank-outline'

export function Sources({ app }: { app: AppModel }) {
  const model = useModel(() => new SourcesModel(app.api))
  const entries = model.entries.value
  const enabled = model.enabled.value
  const enabledCount = enabled.size
  const running = model.running.value

  const selected = entries.filter((entry) => enabled.has(sourceKey(entry)))
  const available = entries.filter((entry) => !enabled.has(sourceKey(entry)))

  return (
    <SourcesRoot>
      <SourcesHeader>
        <SourcesDescription text="Pick sources to sync automatically." />
        <SourcesStatus>
          {enabledCount > 0 && <LastSync lastSync={model.lastSync.value} />}
        </SourcesStatus>
        <SyncButton
          onClick={() => model.syncSelected()}
          disabled={running || enabledCount === 0}
        >
          {enabledCount > 0 ? `Sync now (${enabledCount})` : 'Sync now'}
        </SyncButton>
      </SourcesHeader>
      <SourcesErrors error={model.error.value} />

      <SourcesBody>
        {!model.loaded.value
          ? <SourcesSkeleton />
          : entries.length === 0
            ? <SourcesEmpty />
            : (
              <div className="space-y-4">
                {selected.length > 0
                  ? <SourceCardList entries={selected} enabled={enabled} onToggle={model.toggle} />
                  : <SourcesGrid><SourcesSelectedEmpty /></SourcesGrid>}
                {available.length > 0 && (
                  <>
                    <div className="h-px bg-border-2" />
                    <SourceCardList entries={available} enabled={enabled} onToggle={model.toggle} />
                  </>
                )}
              </div>
            )}
      </SourcesBody>
    </SourcesRoot>
  )
}

// --- components ---

function SourcesRoot({ children }: { children: ReactNode }) {
  return <div className="flex h-full min-h-0 flex-col">{children}</div>
}

// SourcesHeader

function SourcesHeader({ children }: { children: ReactNode }) {
  return <header className="flex shrink-0 items-center gap-3 px-4 py-3">{children}</header>
}

function SourcesDescription({ text }: { text: string }) {
  return <p title={text} className="min-w-0 truncate text-xs text-muted">{text}</p>
}

function SourcesStatus({ children }: { children: ReactNode }) {
  return <div className="ml-auto flex min-w-0 items-center gap-3">{children}</div>
}

function SyncButton(props: ComponentProps<'button'>) {
  return (
    <button
      type="button"
      {...props}
      className={cn(buttonPrimary, 'shrink-0')}
    />
  )
}

function LastSync({ lastSync }: { lastSync: SyncSummary | null }) {
  if (lastSync === null) return null
  const text = `Last sync: ${dateLabel(lastSync.finishedAt)} ${timeLabel(lastSync.finishedAt)}`
  return (
    <time
      dateTime={new Date(lastSync.finishedAt).toISOString()}
      title={text}
      className="min-w-0 truncate font-mono text-xs text-muted"
    >
      Last sync: {relativeAgo(lastSync.finishedAt)}
    </time>
  )
}

function SourcesErrors({ error }: { error: string | null }) {
  if (error === null) return null
  return (
    <div
      role="alert"
      className="max-h-40 shrink-0 space-y-1 overflow-y-auto px-4 pb-2 font-mono text-xs text-warn"
    >
      <p className="whitespace-pre-wrap wrap-break-word">{error}</p>
    </div>
  )
}

// SourcesBody

function SourcesBody({ children }: { children: ReactNode }) {
  return <div className="min-h-0 flex-1 overflow-y-auto px-4 py-2">{children}</div>
}

function SourcesGrid({ children }: { children: ReactNode }) {
  return <div className="grid grid-cols-[repeat(auto-fill,minmax(240px,1fr))] gap-3">{children}</div>
}

function SourceCardList({ entries, enabled, onToggle }: { entries: SourceEntry[]; enabled: Set<string>; onToggle: (key: string) => void }) {
  return (
    <SourcesGrid>
      {entries.map((entry) => {
        const key = sourceKey(entry)
        return (
          <SourceCard
            key={key}
            entry={entry}
            enabled={enabled.has(key)}
            onToggle={() => onToggle(key)}
          />
        )
      })}
    </SourcesGrid>
  )
}

function SourcesSelectedEmpty() {
  return (
    <div className="flex min-h-36 flex-col items-center justify-center gap-2 rounded-lg border border-dashed p-4 text-center">
      <SelectIcon className="size-6 text-muted/60" />
      <span className="text-sm text-muted">No sources selected</span>
    </div>
  )
}

function SourcesEmpty() {
  return <p className="py-6 text-center text-sm text-muted">No sources found. Install a supported browser or add an export file.</p>
}

function SourcesSkeleton() {
  return (
    <SourcesGrid>
      {Array.from({ length: 3 }, (_, i) => <SourcesCardSkeleton key={i} />)}
    </SourcesGrid>
  )
}

function SourcesCardSkeleton() {
  return (
    <div className="flex flex-col gap-2.5 rounded-lg border bg-bg-2 p-4">
      <div className="flex flex-col items-start gap-2">
        <div className="h-10 w-10 animate-pulse rounded-lg bg-bg-3" />
        <div className="grid gap-0.5">
          <div className="h-5 w-28 animate-pulse rounded bg-bg-3" />
          <div className="h-4 w-36 animate-pulse rounded bg-bg-3" />
        </div>
      </div>
      <div className="h-4 w-32 animate-pulse rounded bg-bg-3" />
      <div className="h-4.5 w-20 animate-pulse rounded bg-bg-3" />
    </div>
  )
}
