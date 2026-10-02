import { useMemo } from 'react'
import type { HistoryItem } from '../api'
import { AppModel } from '../models/app'
import { TimelineModel } from '../models/timeline'
import { useModel } from '../lib/useModel'
import { dayKey, dayLabel } from '../lib/dates'
import { Row } from './Row'

interface DayGroup {
  key: string
  label: string
  items: HistoryItem[]
}

function groupByDay(items: HistoryItem[]): DayGroup[] {
  const groups: DayGroup[] = []
  const byKey = new Map<string, DayGroup>()
  for (const item of items) {
    const key = dayKey(item.lastVisit)
    let g = byKey.get(key)
    if (!g) {
      g = { key, label: dayLabel(item.lastVisit), items: [] }
      byKey.set(key, g)
      groups.push(g)
    }
    g.items.push(item)
  }
  return groups
}

export function Timeline({ app }: { app: AppModel }) {
  const {
    items,
    loading,
    done,
    setSentinel,
  } = useModel(() => new TimelineModel(app.api))

  const groups = useMemo(() => groupByDay(items.value), [items.value])

  return (
    <div className="timeline">
      {groups.map((g) => (
        <section className="day" key={g.key}>
          <h2 className="day-label">{g.label}</h2>
          <div className="day-rows">
            {g.items.map((it) => (
              <Row key={it.id} item={it} />
            ))}
          </div>
        </section>
      ))}
      {loading.value && <p className="status">Loading…</p>}
      {done.value && items.value.length === 0 && <p className="status">No history</p>}
      <div ref={(el) => setSentinel(el)} aria-hidden="true" />
    </div>
  )
}
