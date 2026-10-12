import { useModel } from '@/lib/useModel'
import { AppModel } from '@/models/app'
import { UrlsModel } from './urls.model'
import { SearchBar } from '@/components/SearchBar'
import { HistoryRow } from '@/views/HistoryRow'
import { Card } from '@/components/ui/card'
import { ViewRoot } from '../View.components'
import { cn } from 'cn'
import type { ComponentProps } from 'react'

export function Urls({ app }: { app: AppModel }) {
  const {
    items,
    filters,
    loading,
    done,
    setSentinel,
  } = useModel(() => new UrlsModel(app.api))

  return (
    <ViewRoot>
      <Card>
        <UrlsToolbarRoot>
          <SearchBar filters={filters} />
        </UrlsToolbarRoot>
        <UrlsList>
          {items.value.map((it) => (
            <HistoryRow key={it.id} item={it} />
          ))}
        </UrlsList>
        {loading.value && <UrlsLoading />}
        {done.value && items.value.length === 0 && <UrlsEmpty />}
        <UrlsLoadMoreSentinel ref={setSentinel} />
      </Card>
    </ViewRoot>
  )
}

// --- components ---

function UrlsToolbarRoot({ className, ...props }: ComponentProps<'div'>) {
  return <div {...props} className={cn('mb-3', className)} />
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
