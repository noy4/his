import { SourceCard } from './SourceCard'
import { useModel } from '@/lib/useModel'
import { AppModel } from '@/app/app'
import { SourcesModel } from './sources.model'
import type { SyncSummary } from '@/app/api'
import { sourceKey } from '@his/core'
import { cn } from 'cn'
import { type ReactNode } from 'react'

export function Sources({ app }: { app: AppModel }) {
  const model = useModel(() => new SourcesModel(app.api))
  const entries = model.entries.value
  const enabled = model.enabled.value
  const enabledCount = enabled.size
  const running = model.running.value
  const error = model.error.value

  return (
    <SourcesRoot>
      <SourcesHeader>
        <SourcesToolbar>
          <SyncButton
            onClick={() => model.syncSelected()}
            disabled={running || enabledCount === 0}
            running={running}
          >
            {enabledCount > 0 ? `Sync now (${enabledCount})` : 'Sync now'}
          </SyncButton>
        </SourcesToolbar>
        <RunSummary run={model.lastSync.value} />
        {error !== null
          ? <p className="mt-2 font-mono text-xs text-warn">{error}</p>
          : entries.length > 0 && enabledCount === 0
            ? <p className="mt-2 font-mono text-xs text-muted">no sync targets selected — auto sync is off</p>
            : null}
      </SourcesHeader>

      <SourcesBody>
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
  return <header className="shrink-0 border-b px-4 py-3">{children}</header>
}

function SourcesToolbar({ children }: { children: ReactNode }) {
  return <div className="flex items-center justify-end gap-2">{children}</div>
}

function SyncButton({ children, onClick, disabled, running }: { children: ReactNode; onClick: () => void; disabled?: boolean; running: boolean }) {
  return (
    <button
      type="button"
      onClick={onClick}
      disabled={disabled}
      className={cn(
        'inline-flex items-center gap-1.5 rounded bg-primary px-3 py-1.5 text-sm font-medium text-white transition-opacity disabled:pointer-events-none disabled:opacity-40',
        running ? 'opacity-80' : 'hover:opacity-90',
      )}
    >
      {children}
    </button>
  )
}

function RunSummary({ run }: { run: SyncSummary | null }) {
  if (run === null) return null
  const synced = run.attempted - run.failures
  return (
    <p className="mt-2 font-mono text-xs text-muted">
      {synced}/{run.attempted} synced · {run.skipped} skipped · +{run.insertedVisits.toLocaleString()} visits
    </p>
  )
}

// SourcesBody

function SourcesBody({ children }: { children: ReactNode }) {
  return (
    <div className="min-h-0 flex-1 overflow-y-auto px-4 py-4">
      <div className="grid grid-cols-[repeat(auto-fill,minmax(240px,1fr))] gap-3">
        {children}
      </div>
    </div>
  )
}
