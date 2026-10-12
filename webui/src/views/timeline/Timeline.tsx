import { useModel } from '@/lib/useModel'
import { isoDay, relativeDateLabel } from '@/lib/date'
import { AppModel } from '@/models/app'
import { SearchBar } from '@/components/SearchBar'
import { HistoryRow } from '@/views/HistoryRow'
import type { HistoryItem } from '@/api'
import { Card, CardTitle } from '@/components/ui/card'
import { ViewRoot } from '../View.components'

export function Timeline({ app }: { app: AppModel }) {
  const {
    items,
    loading,
    done,
    setSentinel,
  } = useModel(() => app.history)
  const groups = groupByDay(items.value)
  return (
    <ViewRoot>
      <Card>
        <CardTitle>Timeline</CardTitle>
        <div className="mb-3">
          <SearchBar app={app} />
        </div>
        {groups.map((g) => (
          <section className="mb-2" key={g.key}>
            <h3 className="sticky -top-4 z-10 bg-bg-2 py-1 text-xs font-semibold text-muted">
              {g.label}
            </h3>
            <div className="grid">
              {g.items.map((it) => (
                <HistoryRow key={it.id} item={it} />
              ))}
            </div>
          </section>
        ))}
        {loading.value && (
          <p className="py-4 text-center font-mono text-[0.75rem] text-muted">Loading…</p>
        )}
        {done.value && items.value.length === 0 && (
          <p className="py-4 text-center font-mono text-[0.75rem] text-muted">No history</p>
        )}
        <div ref={(el) => setSentinel(el)} aria-hidden="true" />
      </Card>
    </ViewRoot>
  )
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
