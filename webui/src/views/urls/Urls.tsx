import { useModel } from '@/lib/useModel'
import { isoDay, relativeDateLabel } from '@/lib/date'
import { AppModel } from '@/app/app'
import { UrlsModel } from './urls.model'
import { SearchBar } from '@/components/SearchBar'
import { HistoryItemRow } from '@/views/HistoryRow'
import { HistoryCardGrid, HistoryItemCard } from '@/views/HistoryCard'
import { HistorySkeleton } from '@/views/HistorySkeleton'
import { Card } from '@/components/ui/card'
import { IconToggleGroup, type IconToggleOption } from '@/components/ui/toggle-group'
import { ViewRoot } from '../View.components'
import { cn } from 'cn'
import type { ComponentProps } from 'react'
import type { HistoryItem } from '@/app/api'
import ListIcon from '~icons/mdi/format-list-bulleted'
import GridIcon from '~icons/mdi/view-grid-outline'

export function Urls({ app }: { app: AppModel }) {
  const {
    items,
    filters,
    loading,
    done,
    setSentinel,
    view,
    setView,
  } = useModel(() => new UrlsModel(app.api))

  const groups = groupByDay(items.value)
  const isCardView = view.value === 'card'
  const initialLoading = loading.value && items.value.length === 0

  return (
    <ViewRoot>
      <Card>
        <UrlsToolbarRoot>
          <SearchBar filters={filters} />
          <span className="ml-auto" />
          <UrlsViewToggle view={view.value} onChange={setView} />
        </UrlsToolbarRoot>
        {initialLoading ? (
          <HistorySkeleton view={view.value} />
        ) : (
          groups.map((g) => (
            <UrlsGroupRoot key={g.key}>
              <UrlsGroupTitle text={g.label} />
              {isCardView ? (
                <HistoryCardGrid>
                  {g.items.map((it) => (
                    <HistoryItemCard key={it.id} item={it} />
                  ))}
                </HistoryCardGrid>
              ) : (
                <UrlsGroupContent>
                  {g.items.map((it) => (
                    <HistoryItemRow key={it.id} item={it} />
                  ))}
                </UrlsGroupContent>
              )}
            </UrlsGroupRoot>
          ))
        )}
        {!initialLoading && loading.value && <UrlsLoading />}
        {done.value && items.value.length === 0 && <UrlsEmpty />}
        <UrlsLoadMoreSentinel ref={setSentinel} />
      </Card>
    </ViewRoot>
  )
}

// --- components ---

function UrlsToolbarRoot({ className, ...props }: ComponentProps<'div'>) {
  return <div {...props} className={cn('mb-3 flex flex-wrap items-center gap-1.5', className)} />
}

const VIEW_OPTIONS: IconToggleOption[] = [
  { value: 'list', label: 'List', Icon: ListIcon },
  { value: 'card', label: 'Cards', Icon: GridIcon },
]

function UrlsViewToggle({ view, onChange }: { view: string; onChange: (v: string) => void }) {
  return (
    <IconToggleGroup
      aria-label="View"
      value={view}
      onChange={onChange}
      options={VIEW_OPTIONS}
    />
  )
}

function UrlsGroupRoot({ className, ...props }: ComponentProps<'section'>) {
  return <section {...props} className={cn('mb-2', className)} />
}

function UrlsGroupTitle({ text, className, ...props }: Omit<ComponentProps<'h3'>, 'children'> & { text: string }) {
  return (
    <h3
      {...props}
      className={cn('sticky -top-4 z-10 bg-bg-2 py-1 text-xs font-semibold text-muted', className)}
    >
      {text}
    </h3>
  )
}

function UrlsGroupContent({ className, ...props }: ComponentProps<'div'>) {
  return <div {...props} className={cn('grid', className)} />
}

function UrlsLoading() {
  return <p className="py-4 text-center font-mono text-xs text-muted">Loading…</p>
}

function UrlsEmpty() {
  return <p className="py-4 text-center font-mono text-xs text-muted">No history</p>
}

function UrlsLoadMoreSentinel(props: ComponentProps<'div'>) {
  return <div {...props} aria-hidden="true" />
}

// --- helpers ---

interface DayGroup {
  key: string
  label: string
  items: HistoryItem[]
}

function groupByDay(items: HistoryItem[]): DayGroup[] {
  const groups: DayGroup[] = []
  const byKey = new Map<string, DayGroup>()
  for (const item of items) {
    const key = isoDay(item.lastVisit)
    let g = byKey.get(key)
    if (!g) {
      g = { key, label: relativeDateLabel(item.lastVisit), items: [] }
      byKey.set(key, g)
      groups.push(g)
    }
    g.items.push(item)
  }
  return groups
}
