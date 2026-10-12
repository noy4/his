import { useModel } from '@/lib/useModel'
import { isoDay, relativeDateLabel } from '@/lib/date'
import { AppModel } from '@/app/app'
import { SearchBar } from '@/components/SearchBar'
import { HistoryRow } from '@/views/HistoryRow'
import type { HistoryVisit } from '@/app/api'
import { Card } from '@/components/ui/card'
import { ViewRoot } from '../View.components'
import { cn } from 'cn'
import type { ComponentProps } from 'react'
import { VisitsModel } from './visits.model'

export function Visits({ app }: { app: AppModel }) {
  const {
    items,
    filters,
    loading,
    done,
    setSentinel,
  } = useModel(() => new VisitsModel(app.api))
  const groups = groupByDay(items.value)

  return (
    <ViewRoot>
      <Card>
        <VisitsToolbarRoot>
          <SearchBar filters={filters} />
        </VisitsToolbarRoot>
        {groups.map((g) => (
          <VisitsGroupRoot key={g.key}>
            <VisitsGroupTitle text={g.label} />
            <VisitsGroupContent>
              {g.items.map((it) => (
                <HistoryRow key={it.id} item={it} />
              ))}
            </VisitsGroupContent>
          </VisitsGroupRoot>
        ))}
        {loading.value && <VisitsLoading />}
        {done.value && items.value.length === 0 && <VisitsEmpty />}
        <VisitsLoadMoreSentinel ref={setSentinel} />
      </Card>
    </ViewRoot>
  )
}

// --- components ---

function VisitsToolbarRoot({ className, ...props }: ComponentProps<'div'>) {
  return (
    <div {...props} className={cn('mb-3', className)} />
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
