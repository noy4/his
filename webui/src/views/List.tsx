import { useModel } from '@/lib/useModel'
import { AppModel } from '@/models/app'
import { Row } from '@/views/Row'

export function List({ app }: { app: AppModel }) {
  const {
    items,
    loading,
    done,
    setSentinel,
  } = useModel(() => app.history)

  return (
    <div>
      <div className="grid">
        {items.value.map((it) => (
          <Row key={it.id} item={it} />
        ))}
      </div>
      {loading.value && <p className="py-4 text-center font-mono text-[0.75rem] text-muted">Loading…</p>}
      {done.value && items.value.length === 0 && (
        <p className="py-4 text-center font-mono text-[0.75rem] text-muted">No history</p>
      )}
      <div ref={(el) => setSentinel(el)} aria-hidden="true" />
    </div>
  )
}
