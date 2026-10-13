import { useModel } from '@/lib/useModel'
import { AppModel } from '@/app/app'
import { UrlsModel } from './urls.model'
import { SearchBar } from '@/components/SearchBar'
import { HistoryRow } from '@/views/HistoryRow'
import { HistoryCard, HistoryCardGrid } from '@/views/HistoryCard'
import { Card } from '@/components/ui/card'
import { IconToggleGroup, type IconToggleOption } from '@/components/ui/toggle-group'
import { ViewRoot } from '../View.components'
import { cn } from 'cn'
import type { ComponentProps } from 'react'
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

  const isCardView = view.value === 'card'

  return (
    <ViewRoot>
      <Card>
        <UrlsToolbarRoot>
          <SearchBar filters={filters} />
          <span className="ml-auto" />
          <UrlsViewToggle view={view.value} onChange={setView} />
        </UrlsToolbarRoot>
        {isCardView ? (
          <HistoryCardGrid>
            {items.value.map((it) => (
              <HistoryCard key={it.id} item={it} />
            ))}
          </HistoryCardGrid>
        ) : (
          <UrlsList>
            {items.value.map((it) => (
              <HistoryRow key={it.id} item={it} />
            ))}
          </UrlsList>
        )}
        {loading.value && <UrlsLoading />}
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

function UrlsList({ className, ...props }: ComponentProps<'div'>) {
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
