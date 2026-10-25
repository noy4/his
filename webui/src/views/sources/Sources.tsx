import { SourceCard } from './SourceCard'
import { useModel } from '@/lib/useModel'
import { AppModel } from '@/app/app'
import { SourcesModel } from './sources.model'
import type { SyncSummary } from '@/app/api'
import { sourceKey } from '@his/core'
import { cn } from 'cn'
import { buttonPrimary } from '@/components/ui/button'
import { type ReactNode } from 'react'

export function Sources({ app }: { app: AppModel }) {
  const model = useModel(() => new SourcesModel(app.api))
  const entries = model.entries.value
  const enabled = model.enabled.value
  const enabledCount = enabled.size
  const running = model.running.value
  const error = model.error.value
  const notice = error ?? (entries.length > 0 && enabledCount === 0 ? 'no sync targets selected' : null)

  return (
    <SourcesRoot>
      <SourcesHeader>
        <SourcesDescription text="Pick the sources to import. Selected ones sync automatically." />
        <SourcesStatus>
          <RunSummary run={model.lastSync.value} />
          {notice !== null && <SourcesNotice text={notice} />}
        </SourcesStatus>
        <SyncButton
          onClick={() => model.syncSelected()}
          disabled={running || enabledCount === 0}
        >
          {enabledCount > 0 ? `Sync now (${enabledCount})` : 'Sync now'}
        </SyncButton>
      </SourcesHeader>

      <SourcesBody>
        {!model.loaded.value
          ? <SourcesSkeleton />
          : entries.length === 0
            ? <SourcesEmpty />
            : (
              <SourcesGrid>
                {entries.map((entry) => {
                  const key = sourceKey(entry)
                  return (
                    <SourceCard
                      key={key}
                      entry={entry}
                      enabled={enabled.has(key)}
                      onToggle={() => model.toggle(key)}
                    />
                  )
                })}
              </SourcesGrid>
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
  return <p className="text-xs leading-relaxed text-muted">{text}</p>
}

function SourcesStatus({ children }: { children: ReactNode }) {
  return <div className="ml-auto flex shrink-0 items-center gap-3">{children}</div>
}

function SourcesNotice({ text }: { text: string }) {
  return <span className="font-mono text-xs text-warn">{text}</span>
}

function SyncButton({ children, onClick, disabled }: { children: ReactNode; onClick: () => void; disabled?: boolean }) {
  return (
    <button
      type="button"
      onClick={onClick}
      disabled={disabled}
      className={cn(buttonPrimary, 'shrink-0')}
    >
      {children}
    </button>
  )
}

function RunSummary({ run }: { run: SyncSummary | null }) {
  if (run === null) return null
  const synced = run.attempted - run.failures
  return (
    <span className="font-mono text-xs text-muted">
      {synced}/{run.attempted} synced · {run.skipped} skipped · +{run.insertedVisits.toLocaleString()} visits
    </span>
  )
}

// SourcesBody

function SourcesBody({ children }: { children: ReactNode }) {
  return <div className="min-h-0 flex-1 overflow-y-auto px-4 py-2">{children}</div>
}

function SourcesGrid({ children }: { children: ReactNode }) {
  return <div className="grid grid-cols-[repeat(auto-fill,minmax(240px,1fr))] gap-3">{children}</div>
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
