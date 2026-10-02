import { AppModel } from '../../models/app'
import { TimelineModel } from './timeline.model'
import { useModel } from '../../lib/useModel'
import { Row } from '../Row'

export function Timeline({ app }: { app: AppModel }) {
  const {
    items,
    groups,
    loading,
    done,
    setSentinel,
  } = useModel(() => new TimelineModel(app.api))

  return (
    <div className="timeline">
      {groups.value.map((g) => (
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
