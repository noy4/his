import { useModel } from '@/lib/useModel'
import { isoDay, relativeDateLabel } from '@/lib/date'
import { AppModel } from '@/models/app'
import { SearchBar } from '@/components/SearchBar'
import { HistoryRow } from '@/views/HistoryRow'
import type { HistoryVisit } from '@/api'
import { Card } from '@/components/ui/card'
import { ViewRoot } from '../View.components'
import { cn } from 'cn'
import type { ComponentProps } from 'react'
import { TimelineModel } from './timeline.model'

export function Timeline({ app }: { app: AppModel }) {
  const {
    items,
    filters,
    loading,
    done,
    setSentinel,
  } = useModel(() => new TimelineModel(app.api))
  const groups = groupByDay(items.value)

  return (
    <ViewRoot>
      <Card>
        <TimelineToolbarRoot>
          <SearchBar filters={filters} />
        </TimelineToolbarRoot>
        {groups.map((g) => (
          <TimelineGroupRoot key={g.key}>
            <TimelineGroupTitle text={g.label} />
            <TimelineGroupContent>
              {g.items.map((it) => (
                <HistoryRow key={it.id} item={it} />
              ))}
            </TimelineGroupContent>
          </TimelineGroupRoot>
        ))}
        {loading.value && <TimelineLoading />}
        {done.value && items.value.length === 0 && <TimelineEmpty />}
        <TimelineLoadMoreSentinel ref={setSentinel} />
      </Card>
    </ViewRoot>
  )
}

// --- components ---

function TimelineToolbarRoot({ className, ...props }: ComponentProps<'div'>) {
  return (
    <div {...props} className={cn('mb-3', className)} />
  )
}

function TimelineGroupRoot({ className, ...props }: ComponentProps<'section'>) {
  return <section {...props} className={cn('mb-2', className)} />
}

function TimelineGroupTitle({ text, className, ...props }: Omit<ComponentProps<'h3'>, 'children'> & { text: string }) {
  return (
    <h3
      {...props}
      className={cn('sticky -top-4 z-10 bg-bg-2 py-1 text-xs font-semibold text-muted', className)}
    >
      {text}
    </h3>
  )
}

function TimelineGroupContent({ className, ...props }: ComponentProps<'div'>) {
  return <div {...props} className={cn('grid', className)} />
}

function TimelineLoading() {
  return <p className="py-4 text-center font-mono text-[0.75rem] text-muted">Loading…</p>
}

function TimelineEmpty() {
  return <p className="py-4 text-center font-mono text-[0.75rem] text-muted">No history</p>
}

function TimelineLoadMoreSentinel(props: ComponentProps<'div'>) {
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
