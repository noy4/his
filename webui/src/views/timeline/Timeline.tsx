import { useModel } from '@/lib/useModel'
import { isoDay, relativeDateLabel } from '@/lib/date'
import { AppModel } from '@/models/app'
import { Row } from '@/views/Row'
import type { HistoryItem } from '@/api'

export function Timeline({ app }: { app: AppModel }) {
  const {
    items,
    loading,
    done,
    setSentinel,
  } = useModel(() => app.history)
  const groups = groupByDay(items.value)
  return (
    <div>
      {groups.map((g) => (
        <section className="mb-5" key={g.key}>
          <h2 className="mb-1 border-b border-line pb-1.5 font-mono text-[0.7rem] font-semibold tracking-[0.1em] text-muted uppercase">
            {g.label}
          </h2>
          <div className="grid">
            {g.items.map((it) => (
              <Row key={it.id} item={it} />
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
    </div>
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
