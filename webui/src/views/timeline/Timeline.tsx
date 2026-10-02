import { useModel } from '@/lib/useModel'
import { AppModel } from '@/models/app'
import { Row } from '@/views/Row'
import { TimelineModel } from './timeline.model'

export function Timeline({ app }: { app: AppModel }) {
  const {
    items,
    groups,
    loading,
    done,
    setSentinel,
  } = useModel(() => new TimelineModel(app.api))

  return (
    <div>
      {groups.value.map((g) => (
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
      {loading.value && <p className="py-4 text-center font-mono text-[0.75rem] text-muted">Loading…</p>}
      {done.value && items.value.length === 0 && (
        <p className="py-4 text-center font-mono text-[0.75rem] text-muted">No history</p>
      )}
      <div ref={(el) => setSentinel(el)} aria-hidden="true" />
    </div>
  )
}
