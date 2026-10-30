import { useModel } from '@/lib/useModel'
import { isoDay, relativeDateLabel } from '@/lib/date'
import { AppModel } from '@/app/app'
import { SearchBar } from '@/components/SearchBar'
import { HistoryVisitRow } from '@/components/view/HistoryRow'
import { HistoryCardGrid, HistoryVisitCard } from '@/components/view/HistoryCard'
import { HistorySkeleton } from '@/components/view/HistorySkeleton'
import { IconToggleGroup, type IconToggleOption } from '@/components/ui/toggle-group'
import type { HistoryVisit } from '@/app/api'
import { Card } from '@/components/ui/card'
import { ViewRoot } from '@/components/view/ViewRoot'
import { cn } from 'cn'
import type { ComponentProps } from 'react'
import ListIcon from '~icons/mdi/format-list-bulleted'
import GridIcon from '~icons/mdi/view-grid-outline'
import { VisitsModel } from './visits.model'

export function Visits({ app }: { app: AppModel }) {
  const {
    items,
    filters,
    loading,
    done,
    setSentinel,
    view,
    setView,
  } = useModel(() => new VisitsModel(app.api))
  const groups = groupByDay(items.value)
  const isCardView = view.value === 'card'
  const initialLoading = loading.value && items.value.length === 0

  return (
    <ViewRoot>
      <Card>
        <VisitsToolbarRoot>
          <SearchBar filters={filters} />
          <span className="ml-auto" />
          <VisitsViewToggle view={view.value} onChange={setView} />
        </VisitsToolbarRoot>
        {initialLoading ? (
          <HistorySkeleton view={view.value} />
        ) : (
          groups.map((g) => (
            <VisitsGroupRoot key={g.key}>
              <VisitsGroupTitle text={g.label} />
              {isCardView ? (
                <HistoryCardGrid>
                  {g.items.map((it) => (
                    <HistoryVisitCard key={it.id} item={it} />
                  ))}
                </HistoryCardGrid>
              ) : (
                <VisitsGroupContent>
                  {g.items.map((it) => (
                    <HistoryVisitRow key={it.id} item={it} />
                  ))}
                </VisitsGroupContent>
              )}
            </VisitsGroupRoot>
          ))
        )}
        {!initialLoading && loading.value && <VisitsLoading />}
        {done.value && items.value.length === 0 && <VisitsEmpty />}
        <VisitsLoadMoreSentinel ref={setSentinel} />
      </Card>
    </ViewRoot>
  )
}

// --- components ---

function VisitsToolbarRoot({ className, ...props }: ComponentProps<'div'>) {
  return (
    <div {...props} className={cn('mb-3 flex flex-wrap items-center gap-1.5', className)} />
  )
}

const VIEW_OPTIONS: IconToggleOption[] = [
  { value: 'list', label: 'List', Icon: ListIcon },
  { value: 'card', label: 'Cards', Icon: GridIcon },
]

function VisitsViewToggle({ view, onChange }: { view: string; onChange: (v: string) => void }) {
  return (
    <IconToggleGroup
      aria-label="View"
      value={view}
      onChange={onChange}
      options={VIEW_OPTIONS}
    />
  )
}

function VisitsGroupRoot({ className, ...props }: ComponentProps<'section'>) {
  return <section {...props} className={cn('mb-2', className)} />
}

function VisitsGroupTitle({ text, className, ...props }: Omit<ComponentProps<'h3'>, 'children'> & { text: string }) {
  return (
    <h3
      {...props}
      className={cn('sticky -top-4 z-10 bg-bg-2 py-1 text-xs font-semibold text-muted', className)}
    >
      {text}
    </h3>
  )
}

function VisitsGroupContent({ className, ...props }: ComponentProps<'div'>) {
  return <div {...props} className={cn('grid', className)} />
}

function VisitsLoading() {
  return <p className="py-4 text-center font-mono text-[0.75rem] text-muted">Loading…</p>
}

function VisitsEmpty() {
  return <p className="py-4 text-center font-mono text-[0.75rem] text-muted">No history</p>
}

function VisitsLoadMoreSentinel(props: ComponentProps<'div'>) {
  return <div {...props} aria-hidden="true" />
}

// --- helpers ---

interface DayGroup {
  key: string
  label: string
  items: HistoryVisit[]
}

function groupByDay(items: HistoryVisit[]): DayGroup[] {
  const groups: DayGroup[] = []
  const byKey = new Map<string, DayGroup>()
  for (const item of items) {
    const key = isoDay(item.visitTime)
    let g = byKey.get(key)
    if (!g) {
      g = { key, label: relativeDateLabel(item.visitTime), items: [] }
      byKey.set(key, g)
      groups.push(g)
    }
    g.items.push(item)
  }
  return groups
}
