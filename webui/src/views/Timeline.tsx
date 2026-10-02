import { useEffect, useMemo, useRef, useState } from 'react'
import type { HistoryItem } from '../api'
import { AppModel } from '../models/app'
import { TimelineModel } from '../models/timeline'
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
  const [m] = useState(() => new TimelineModel(app.api))
  const sentinel = useRef<HTMLDivElement | null>(null)

  useEffect(() => {
    m.start()
  }, [m])

  useEffect(() => {
    const el = sentinel.current
    if (!el) return
    const io = new IntersectionObserver(
      (entries) => {
        if (entries.some((e) => e.isIntersecting)) m.loadMore()
      },
      { rootMargin: '240px 0px' },
    )
    io.observe(el)
    return () => io.disconnect()
  }, [m])

  const items = m.items.value
  const loading = m.loading.value
  const groups = useMemo(() => groupByDay(items), [items])

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
      {loading && <p className="status">Loading…</p>}
      {m.done.value && items.length === 0 && <p className="status">No history</p>}
      <div ref={sentinel} aria-hidden="true" />
    </div>
  )
}
